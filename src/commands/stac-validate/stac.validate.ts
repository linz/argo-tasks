import { fsa, FsHttp } from '@chunkd/fs';
import type { DefinedError, ValidateFunction } from 'ajv';
import Ajv from 'ajv';
import { fastFormats } from 'ajv-formats/dist/formats.js';
import { boolean, command, flag, number, option, restPositionals } from 'cmd-ts';
import { createHash } from 'crypto';
import { performance } from 'perf_hooks';
import type * as st from 'stac-ts';
import { pathToFileURL } from 'url';

import { CliInfo } from '../../cli.info.ts';
import { logger } from '../../log.ts';
import { ConcurrentQueue } from '../../utils/concurrent.queue.ts';
import { protocolAwareString } from '../../utils/filelist.ts';
import { hashStream, Sha256Prefix } from '../../utils/hash.ts';
import { config, registerCli, UrlList, verbose } from '../common.ts';

export const commandStacValidate = command({
  name: 'stac-validate',
  description: 'Validate STAC files',
  version: CliInfo.version,
  args: {
    config,
    verbose,
    concurrency: option({
      type: number,
      defaultValue: () => 25,
      long: 'concurrency',
      description: 'Number of requests to run concurrently',
    }),
    checksumAssets: flag({
      type: boolean,
      defaultValue: () => false,
      long: 'checksum-assets',
      description: 'Validate the file:checksum of each asset if it exists',
    }),
    checksumLinks: flag({
      type: boolean,
      defaultValue: () => false,
      long: 'checksum-links',
      description: 'Validate the file:checksum of each STAC link if it exists',
    }),
    recursive: flag({
      type: boolean,
      defaultValue: () => true,
      long: 'recursive',
      description: 'Follow and validate STAC links',
    }),
    strict: flag({
      type: boolean,
      defaultValue: () => true,
      long: 'strict',
      description: 'Strict checking',
    }),
    location: restPositionals({
      type: UrlList,
      displayName: 'location',
      description: 'Location of the STAC files to validate',
    }),
  },

  async handler(args) {
    fsa.register('https://', new FsHttp());

    registerCli(this, args);

    logger.info('StacValidation:Start');
    const validated = new Set<URL>();

    const recursive = args.recursive;

    if (args.location[0] === undefined) {
      logger.error('StacValidation:Error:NoLocationProvided');
      process.exit(1);
    }
    const stacFileLocations = args.location.flat();

    // Weird typing for ajv require us to use the "default" export to construct it.
    const ajv = new Ajv.default({
      allErrors: true,
      strict: args.strict,
      loadSchema: loadSchema,
      formats: {
        ...fastFormats,
        // iri is a more relaxed format than URI but for our purposes a URI should be close enough
        iri: fastFormats.uri,
        'iri-reference': fastFormats['uri-reference'],
      },
    });

    // To prevent concurrency issues compile schemas one at a time
    let schemaQueue: Promise<unknown> = Promise.resolve();
    const ajvSchema = new Map<string, Promise<ValidateFunction>>();
    const queue = new ConcurrentQueue(args.concurrency);

    /**
     * Lookup or load and compile an AJV validator from a JSONSchema URL
     * @param location JSONSchema URL
     * @returns
     */
    async function getValidator(location: URL): Promise<ValidateFunction> {
      /**
       * Calling `getSchema(location)` while the schema at `location` is still loading can cause the schema to fail to load correctly
       * To work around this problem ensure only one schema is compiling at a time.
       */
      await schemaQueue;

      const schema = ajv.getSchema(location.href);
      if (schema != null) return schema;
      let existing = ajvSchema.get(location.href);

      if (existing == null) {
        existing = schemaQueue.then(() => loadSchema(location.href).then((f) => ajv.compileAsync(f)));
        ajvSchema.set(location.href, existing);
        // Queue should ignore errors so if something in the queue fails it can continue to run
        schemaQueue = existing.catch(() => null);
      }
      return existing;
    }

    const failures: URL[] = [];

    async function validateStac(stacFileLocation: URL): Promise<void> {
      if (validated.has(stacFileLocation)) {
        logger.warn({ stacFileLocation: protocolAwareString(stacFileLocation) }, 'SkippedDuplicateStacFile');
        return;
      }
      validated.add(stacFileLocation);

      const stacSchemas: URL[] = [];
      let stacJson;
      try {
        stacJson = await fsa.readJson<st.StacItem | st.StacCollection | st.StacCatalog>(stacFileLocation);
      } catch (err) {
        logger.error({ stacFileLocation: protocolAwareString(stacFileLocation), err }, 'readStacJsonFile:Error');
        failures.push(stacFileLocation);
        return;
      }

      const schema = getStacSchemaUrl(stacJson.type, stacJson.stac_version, stacFileLocation);
      if (schema === null) {
        logger.error(
          {
            stacFileLocation: protocolAwareString(stacFileLocation),
            stacType: stacJson.type,
            stacVersion: stacJson.stac_version,
          },
          'getStacSchemaUrl:Error',
        );
        failures.push(stacFileLocation);
        return;
      }

      stacSchemas.push(schema);
      if (stacJson.stac_extensions) {
        for (const se of stacJson.stac_extensions) stacSchemas.push(fsa.toUrl(se));
      }

      let isOk = true;
      for (const sch of stacSchemas) {
        const validate = await getValidator(sch);

        logger.trace(
          {
            title: stacJson.title,
            type: stacJson.type,
            stacFileLocation: protocolAwareString(stacFileLocation),
            schema: sch,
          },
          'Validation:Start',
        );
        const valid = validate(stacJson);
        if (valid === true) {
          logger.trace(
            {
              title: stacJson.title,
              type: stacJson.type,
              stacFileLocation: protocolAwareString(stacFileLocation),
              valid,
              schema: sch,
            },
            'Validation:Done:Ok',
          );
          continue;
        }

        isOk = false;
        for (const err of validate.errors as DefinedError[]) {
          logger.error(
            {
              stacFileLocation: protocolAwareString(stacFileLocation),
              instancePath: err.instancePath,
              schemaPath: err.schemaPath,
              keyword: err.keyword,
              params: err.params,
              message: err.message,
            },
            'Validation:Failed',
          );
        }
        failures.push(stacFileLocation);
        logger.error(
          {
            title: stacJson.title,
            type: stacJson.type,
            stacFileLocation: protocolAwareString(stacFileLocation),
            valid,
          },
          'Validation:Done:Failed',
        );
      }

      if (args.checksumAssets) {
        const assetFailures = await validateAssets(stacJson, stacFileLocation);
        if (assetFailures.length > 0) {
          isOk = false;
          failures.push(...assetFailures);
        }
      }

      if (args.checksumLinks) {
        const linksFailures = await validateLinks(stacJson, stacFileLocation);
        if (linksFailures.length > 0) {
          isOk = false;
          failures.push(...linksFailures);
        }
      }

      if (isOk)
        logger.info(
          { title: stacJson.title, type: stacJson.type, stacFileLocation: protocolAwareString(stacFileLocation) },
          'Validation:Done:Ok',
        );

      if (recursive) {
        for (const child of getStacChildren(stacJson, stacFileLocation)) {
          queue.push(() =>
            validateStac(child).catch((err: unknown) => {
              logger.error({ err, path: protocolAwareString(child) }, 'Failed');
              failures.push(child);
            }),
          );
        }
      }
    }

    for (const stacFileLocation of stacFileLocations) {
      queue.push(() =>
        validateStac(stacFileLocation).catch((err: unknown) => {
          logger.error({ err, stacFileLocation: protocolAwareString(stacFileLocation) }, 'Failed');
          failures.push(stacFileLocation);
          process.exit();
        }),
      );
    }

    await queue.join();

    if (failures.length > 0) {
      logger.error({ count: failures.length }, 'StacValidation:Done:Failed');
      process.exit(1);
    } else {
      logger.info('StacValidation:Done:Ok');
    }
  },
});

/**
 * Validate STAC Assets
 *
 * @param stacJson
 * @param stacFileLocation URL of the STAC location
 * @returns the list of link paths that failed the validation
 */
export async function validateAssets(
  stacJson: st.StacItem | st.StacCollection | st.StacCatalog,
  stacFileLocation: URL,
): Promise<URL[]> {
  const assetsFailures: URL[] = [];
  const assets = Object.values(stacJson.assets ?? {}) as st.StacAsset[];
  for (const asset of assets) {
    const isChecksumValid = await validateStacChecksum(asset, stacFileLocation, false);
    if (!isChecksumValid) assetsFailures.push(stacFileLocation);
  }
  return assetsFailures;
}

/**
 * Validate STAC Links
 *
 * @param stacJson
 * @param stacFileLocation URL to the STAC file
 * @returns the list of links that failed the validation
 */
export async function validateLinks(
  stacJson: st.StacItem | st.StacCollection | st.StacCatalog,
  stacFileLocation: URL,
): Promise<URL[]> {
  const linksFailures: URL[] = [];
  for (const link of stacJson.links) {
    if (link.rel === 'self') continue;

    // Allowing missing checksums as some STAC links might not have checksum
    const isChecksumValid = await validateStacChecksum(link, stacFileLocation, true);
    if (!isChecksumValid) linksFailures.push(stacFileLocation);
  }
  return linksFailures;
}

/**
 * Store a local copy of JSON schemas into a cache directory
 *
 * This is to prevent overloading the remote hosts as stac validation can trigger lots of schema requests
 *
 * @param urlString JSON schema to load (string due to ajv.loadSchema signature)
 * @returns object from the cache if it exists or directly from the uri
 */
async function loadSchema(urlString: string): Promise<object> {
  const schemaLocation = fsa.toUrl(urlString);
  const cacheId = createHash('sha256').update(schemaLocation.href).digest('hex');
  const cachePath = pathToFileURL(`./json-schema-cache/${cacheId}.json`);
  try {
    return await fsa.readJson<object>(cachePath);
  } catch (e) {
    return fsa.read(schemaLocation).then(async (obj) => {
      logger.info(
        { schemaLocation: protocolAwareString(schemaLocation), cachePath: protocolAwareString(cachePath) },
        'Fetch:CacheMiss',
      );
      await fsa.write(cachePath, obj);
      return JSON.parse(String(obj)) as object;
    });
  }
}

/**
 * Validate if the checksum found in the stacObject (`file:checksum`) corresponds to its actual file checksum.
 * @param stacObject a STAC Link or Asset
 * @param stacFileLocation URL to the STAC file
 * @param allowMissing allow missing checksum to be valid
 * @returns whether the checksum is valid or not
 */
export async function validateStacChecksum(
  stacObject: st.StacLink | st.StacAsset,
  stacFileLocation: URL,
  allowMissing: boolean,
): Promise<boolean> {
  const source = new URL(stacObject.href, stacFileLocation);
  const checksum: string = stacObject['file:checksum'] as string;

  if (checksum == null) {
    if (allowMissing) return true;
    logger.error(
      {
        source: protocolAwareString(source),
        checksum,
        type: stacObject.rel,
        parent: protocolAwareString(stacFileLocation),
      },
      'Validate:Checksum:Missing',
    );
    return false;
  }

  if (!checksum.startsWith(Sha256Prefix)) {
    logger.error(
      {
        source: protocolAwareString(source),
        checksum,
        type: stacObject.rel,
        parent: protocolAwareString(stacFileLocation),
      },
      'Validate:Checksum:Unknown',
    );
    return false;
  }
  logger.debug({ source: protocolAwareString(source), checksum }, 'Validate:Checksum');
  const startTime = performance.now();
  const hash = await hashStream(fsa.readStream(source));
  const duration = performance.now() - startTime;

  if (hash !== checksum) {
    logger.error(
      {
        source: protocolAwareString(source),
        checksum,
        found: hash,
        type: stacObject.rel,
        parent: protocolAwareString(stacFileLocation),
        duration,
      },
      'Checksum:Validation:Failed',
    );
    return false;
  }
  logger.debug(
    {
      source: protocolAwareString(source),
      checksum,
      type: stacObject.rel,
      parent: protocolAwareString(stacFileLocation),
      duration,
    },
    'Checksum:Validation:Ok',
  );
  return true;
}

export type StacSchemaType = 'item' | 'catalog' | 'collection';

/**
 * Convert a GeoJSON type into a STAC schema type
 * @param schemaType GeoJSON schema type eg "Feature"
 * @returns STAC schema type eg "item"
 */
function getSchemaType(schemaType: string): StacSchemaType | null {
  switch (schemaType) {
    case 'Feature':
      return 'item';
    case 'Catalog':
      return 'catalog';
    case 'Collection':
      return 'collection';
    default:
      return null;
  }
}

/**
 * Determine the STAC JSON Schema URL for a stac "type" field and version
 * @param schemaType Type of GeoJSON eg "Feature"
 * @param stacVersion version of STAC to use
 * @param location base location
 * @returns
 */
export function getStacSchemaUrl(schemaType: string, stacVersion: string, location: URL): URL | null {
  logger.trace({ path: protocolAwareString(location), schemaType: schemaType }, 'getStacSchema:Start');
  // Only 1.0.0 is supported
  if (stacVersion !== '1.0.0') return null;

  const type = getSchemaType(schemaType);
  if (type == null) return null;

  const schemaId = `https://schemas.stacspec.org/v${stacVersion}/${type}-spec/json-schema/${type}.json`;
  logger.trace({ path: protocolAwareString(location), schemaType, schemaId }, 'getStacSchema:Done');
  return fsa.toUrl(schemaId);
}

/** STAC link "rel" types that are considered children */
const childrenRel = new Set(['child', 'item']);

/**
 * find all the children items in a STAC document
 *
 * @param stacJson STAC Document
 * @param stacLocation source location of the STAC document to resolve relative paths
 * @returns list of locations of child item
 */
export function getStacChildren(stacJson: st.StacItem | st.StacCollection | st.StacCatalog, stacLocation: URL): URL[] {
  if (stacJson.type === 'Catalog' || stacJson.type === 'Collection') {
    return stacJson.links.filter((f) => childrenRel.has(f.rel)).map((f) => new URL(f.href, stacLocation));
  }
  if (stacJson.type === 'Feature') return [];
  throw new Error(`Unknown Stac Type [${String(stacJson['type'] ?? '')}]: ${protocolAwareString(stacLocation)}`);
}
