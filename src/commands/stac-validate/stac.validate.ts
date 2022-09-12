import { fsa } from '@chunkd/fs';
import { boolean, command, flag, optional, restPositionals, string } from 'cmd-ts';
import { logger } from '../../log.js';
import { config, registerCli, verbose } from '../common.js';
import * as st from 'stac-ts';
import { ConcurrentQueue } from './concurrent.queue.js';

import { fastFormats } from 'ajv-formats/dist/formats.js';
import Ajv, { SchemaObject, ValidateFunction } from 'ajv';

export const commandStacValidate = command({
  name: 'stac-validate',
  args: {
    config,
    verbose,
    recursive: flag({
      type: optional(boolean),
      long: 'recursive',
      description: 'Follow and validate STAC links',
    }),
    strict: flag({
      type: optional(boolean),
      defaultValue: () => false,
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
    const Schemas = new Map<string, Promise<SchemaObject>>();
    registerCli(args);

    const strict = args.strict ?? false;
    //const recursive = args.recursive ?? false;
    const paths = args.location.map((c) => c.trim());

    const ajv = new Ajv({
      allErrors: true,
      strict,
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
    const queue = new ConcurrentQueue(5);
    async function validateStac(path: string): Promise<void> {
      const stacJson = await fsa.readJson<st.StacItem | st.StacCollection | st.StacCatalog>(path);
      const schema = getStacSchemaUrl(stacJson.type, stacJson.stac_version);
      const validate = await loadSchema(schema);
      const valid = validate(stacJson);
      for (const child of getStacChildren(stacJson, path)) {
        queue.push(() => validateStac(child));
      }
      logger.info({ title: stacJson.title, type: stacJson.type, path, valid }, 'Validation:Done');
    }

    for (const path of paths) {
      queue.push(() => validateStac(path));
    }
    await queue.join();
  },
});

function iri(value?: string): boolean {
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

function iriReference(value?: string): boolean {
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

function getStacSchemaUrl(schemaType: string, stacVersion: string): string {
  switch (schemaType) {
    case 'Feature':
      schemaType = 'Item';
    case 'Catalog':
    case 'Collection':
      const type = schemaType.toLowerCase();
      const schemaId = `https://schemas.stacspec.org/v${stacVersion}/${type}-spec/json-schema/${type}.json`;
      return schemaId;
    default:
      throw new Error(`Invalid Schema Type: ${schemaType}`);
  }
}
const validRels = new Set(['child', 'item']);

function getStacChildren(stacJson: st.StacItem | st.StacCollection | st.StacCatalog, path: string): string[] {
  if (stacJson.type === 'Catalog' || stacJson.type === 'Collection') {
    return stacJson.links.filter((f) => validRels.has(f.rel)).map((f) => normaliseHref(f.href, path));
  }
  if (stacJson.type === 'Feature') {
    return [];
  }
  throw new Error(`Unknown Stac Type: ${path}`);
}

function normaliseHref(href: string, path: string): string {
  return new URL(href, path).href;
}
