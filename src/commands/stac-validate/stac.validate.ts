import { fsa } from '@chunkd/fs';
import Ajv, { DefinedError, SchemaObject, ValidateFunction } from 'ajv';
import { fastFormats } from 'ajv-formats/dist/formats.js';
import { boolean, command, flag, number, option, restPositionals, string } from 'cmd-ts';
import { dirname, join } from 'path';
import { performance } from 'perf_hooks';
import * as st from 'stac-ts';
import { logger } from '../../log.js';
import { ConcurrentQueue } from '../../utils/concurrent.queue.js';
import { config, registerCli, verbose } from '../common.js';
import { hashStream } from './hash.worker.js';

export const commandStacValidate = command({
  name: 'stac-validate',
  description: 'Validate STAC files',
  args: {
    config,
    verbose,
    concurrency: option({
      type: number,
      defaultValue: () => 25,
      long: 'concurrency',
      description: 'Number of requests to run concurrently',
    }),
    checksum: flag({
      type: boolean,
      defaultValue: () => false,
      long: 'checksum',
      description: 'Validate the file:checksum if it exists',
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
      type: string,
      displayName: 'location',
      description: 'Location of the STAC files to validate',
    }),
  },

  handler: async (args) => {
    registerCli(args);

    logger.info('StacValidation:Start');
    const Schemas = new Map<string, Promise<SchemaObject>>();
    const validated = new Set<string>();

    const recursive = args.recursive;

    if (args.location[0] === undefined) {
      logger.error('StacValidation:Error:NoLocationProvided');
      process.exit(1);
    }
    const paths = listLocation(args.location).map((c) => c.trim()).flat();

    // Weird typing for ajv require us to use the "default" export to construct it.
    const ajv = new Ajv.default({
      allErrors: true,
      strict: args.strict,
      loadSchema: (uri: string): Promise<SchemaObject> => {
        let existing = Schemas.get(uri);
        if (existing == null) {
          existing = fsa.readJson(uri);
          Schemas.set(uri, existing);
        }
        return existing;
      },
      formats: { ...fastFormats, iri, 'iri-reference': iriReference },
    });

    const ajvSchema = new Map<string, Promise<ValidateFunction>>();

    function loadSchema(uri: string): Promise<ValidateFunction> | ValidateFunction {
      const schema = ajv.getSchema(uri);
      if (schema != null) return schema;
      let existing = ajvSchema.get(uri);
      if (existing == null) {
        existing = fsa.readJson<object>(uri).then((json) => ajv.compileAsync(json));
        ajvSchema.set(uri, existing);
      }
      return existing;
    }
    const failures = [];
    const queue = new ConcurrentQueue(args.concurrency);

    async function validateStac(path: string): Promise<void> {
      if (validated.has(path)) {
        logger.warn({ path }, 'SkippedDuplicateStacFile');
        return;
      }
      validated.add(path);
      const stacSchemas: string[] = [];
      let stacJson;
      try {
        stacJson = await fsa.readJson<st.StacItem | st.StacCollection | st.StacCatalog>(path);
      } catch (err) {
        logger.error({ path, err }, 'readStacJsonFile:Error');
        failures.push(path);
        return;
      }

      const schema = getStacSchemaUrl(stacJson.type, stacJson.stac_version, path);
      if (schema === null) {
        failures.push(path);
        return;
      }
      stacSchemas.push(schema);
      if (stacJson.stac_extensions) {
        for (const se of stacJson.stac_extensions) stacSchemas.push(se);
      }

      let isOk = true;
      for (const sch of stacSchemas) {
        const validate = await loadSchema(sch);
        logger.trace({ title: stacJson.title, type: stacJson.type, path, schema: sch }, 'Validation:Start');
        const valid = validate(stacJson);
        if (valid === true) {
          logger.trace({ title: stacJson.title, type: stacJson.type, path, valid, schema: sch }, 'Validation:Done:Ok');
        } else {
          isOk = false;
          for (const err of validate.errors as DefinedError[]) {
            logger.error(
              {
                path: path,
                instancePath: err.instancePath,
                schemaPath: err.schemaPath,
                keyword: err.keyword,
                params: err.params,
                message: err.message,
              },
              'Validation:Failed',
            );
          }
          failures.push(path);
          logger.error({ title: stacJson.title, type: stacJson.type, path, valid }, 'Validation:Done:Failed');
        }
      }

      if (args.checksum && stacJson.assets) {
        const assets = Object.entries(stacJson.assets ?? {});
        for (const [assetName, asset] of assets) {
          const checksum = asset['file:checksum'];
          if (checksum == null) continue;
          // 12-20 is the starting prefix for all sha256 multihashes
          if (!checksum.startsWith('1220')) continue;

          let source = asset.href;
          if (source.startsWith('./')) source = fsa.join(dirname(path), source.replace('./', ''));

          logger.debug({ source, checksum }, 'Validate:Asset');
          const startTime = performance.now();

          const hash = await hashStream(fsa.stream(source));
          const duration = performance.now() - startTime;

          if (hash === checksum) {
            logger.debug({ assetType: assetName, source, checksum, duration }, 'Asset:Validation:Ok');
          } else {
            isOk = false;
            logger.error({ assetType: assetName, source, checksum, found: hash, duration }, 'Asset:Validation:Failed');
            failures.push(path);
          }
        }
      }

      if (isOk) logger.info({ title: stacJson.title, type: stacJson.type, path }, 'Validation:Done:Ok');
      if (recursive) {
        for (const child of getStacChildren(stacJson, path)) {
          queue.push(() =>
            validateStac(child).catch((err) => {
              logger.error({ err }, 'Failed');
              failures.push(child);
            }),
          );
        }
      }
    }

    for (const path of paths) {
      queue.push(() =>
        validateStac(path).catch((err) => {
          logger.error({ err }, 'Failed');
          failures.push(path);
        }),
      );
    }

    await queue.join();

    if (failures.length > 0) {
      logger.error({ failures: failures.length }, 'StacValidation:Done:Failed');
      process.exit(1);
    } else {
      logger.info('StacValidation:Done:Ok');
    }
  },
});

export function iri(value?: string): boolean {
  if (typeof value !== 'string') return false;
  if (value.length === 0) return false;

  try {
    const iri = new URL(value);
    if (!iri.protocol.startsWith('http')) return false;
    if (iri.host === '') return false;
    return true;
  } catch (e) {
    return false;
  }
}

export function iriReference(value?: string): boolean {
  if (typeof value !== 'string') return false;
  if (value.length === 0) return false;
  if (value.startsWith('./')) return true;

  try {
    const iri = new URL(value);
    if (!iri.protocol.startsWith('http')) return false;
    if (iri.host === '') return false;
    if (iri.pathname !== '/') return false;

    return true;
  } catch (e) {
    return false;
  }
}

function getSchemaType(schemaType: string): string | null {
  switch (schemaType) {
    case 'Feature':
      return 'item';
    case 'Catalog':
    case 'Collection':
      return schemaType.toLowerCase();
    default:
      return null;
  }
}

export function getStacSchemaUrl(schemaType: string, stacVersion: string, path: string): string | null {
  logger.trace({ path, schemaType: schemaType }, 'getStacSchema:Start');
  if (stacVersion !== '1.0.0') {
    logger.error({ stacVersion, schemaType, path }, 'getStacSchema:StacVersionError');
    return null;
  }

  const type = getSchemaType(schemaType);
  if (type == null) {
    logger.error({ path, schemaType }, 'getStacSchema:ErrorInvalidSchemaType');
    return null
  }

  const schemaId = `https://schemas.stacspec.org/v${stacVersion}/${type}-spec/json-schema/${type}.json`;
  logger.trace({ path, schemaType, schemaId }, 'getStacSchema:Done');
  return schemaId;

}
const validRels = new Set(['child', 'item']);

export function getStacChildren(stacJson: st.StacItem | st.StacCollection | st.StacCatalog, path: string): string[] {
  if (stacJson.type === 'Catalog' || stacJson.type === 'Collection') {
    return stacJson.links.filter((f) => validRels.has(f.rel)).map((f) => normaliseHref(f.href, path));
  }
  if (stacJson.type === 'Feature') {
    return [];
  }
  throw new Error(`Unknown Stac Type: ${path}`);
}

export function normaliseHref(href: string, path: string): string {
  if (isURL(path)) {
    return new URL(href, path).href;
  }
  return join(dirname(path), href);
}

export function isURL(path: string): boolean {
  try {
    new URL(path);
    return true;
  } catch (err) {
    return false;
  }
}

// Handle list of lists that results from using the 'list' command to supply location
export function listLocation(locs: string[]): string[] {
  const output: string[] = [];
  for (const loc of locs) {
    if (loc.startsWith('[')) {
      output.push(...JSON.parse(loc) as string[]);
      continue;
    }
    output.push(loc)

    // else
  }
  return output;
}
