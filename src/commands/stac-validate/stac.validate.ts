import { fsa } from '@chunkd/fs';
import { boolean, command, flag, optional, restPositionals, string } from 'cmd-ts';
import { logger } from '../../log.js';
import { config, registerCli, verbose } from '../common.js';

import { fastFormats } from 'ajv-formats/dist/formats.js';
import Ajv from 'ajv';

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
    const Schemas = new Map();
    registerCli(args);

    const strict = args.strict ?? false;
    //const recursive = args.recursive ?? false;
    const paths = args.location.map((c) => c.trim());

    const ajv = new Ajv({
      allErrors: true,
      strict,
      loadSchema: (uri) => {
        let existing = Schemas.get(uri);
        if (existing == null) {
          existing = fsa.readJson(uri);
          Schemas.set(uri, existing);
        }
        return existing;
      },
      formats: { ...fastFormats, iri, 'iri-reference': iriReference } as any,
    });

    const ajvSchema = new Map();

    function loadSchema(uri: string) {
      let schema = ajv.getSchema(uri);
      if (schema != null) return schema;
      let existing = ajvSchema.get(uri);
      if (existing == null) {
        existing = fsa.readJson<object>(uri).then((json) => ajv.compileAsync(json));
        ajvSchema.set(uri, existing);
      }
      return existing;
    }

    function getSchema(schemaType: string, stacVersion: string) {
      console.log({ schemaType });
      switch (schemaType) {
        case 'Feature':
          schemaType = 'Item';
        case 'Catalog':
        case 'Collection':
          var type = schemaType.toLowerCase();
          console.log({ type });
          var schemaId = `https://schemas.stacspec.org/v${stacVersion}/${type}-spec/json-schema/${type}.json`;
          return schemaId;
        default:
          //TO-DO: what is the best thing to do here?
          return 'invalid schema';
      }
    }

    for (var path of paths) {
      // TO-DO: fix this, object doesn't have property type but any lets it through
      var stacJson: any = await fsa.readJson(path);
      var schema = getSchema(stacJson.type, stacJson.stac_version);
      var validate = await loadSchema(schema);
      console.log({ validate });
      const valid = validate(stacJson);
      console.log({ valid });

      //console.log(validate.errors);
    }
    logger.info({ path: stacJson.title, type: stacJson.type }, 'Validation:Done');
  },
});

function iri(value?: string): boolean | undefined {
  if (typeof value !== 'string') return;
  if (value.length === 0) return;

  try {
    const iri = new URL(value);
    if (!iri.protocol.startsWith('http')) return false;
    if (iri.host == '') return false;
    return true;
  } catch (e) {
    return false;
  }
}

function iriReference(value?: string): boolean | undefined {
  if (typeof value !== 'string') return;
  if (value.length === 0) return;
  if (value.startsWith('./')) return true;

  try {
    const iri = new URL(value);
    if (!iri.protocol.startsWith('http')) return false;
    if (iri.host == '') return false;
    if (iri.pathname != '/') return false;

    return true;
  } catch (e) {
    return false;
  }
}
