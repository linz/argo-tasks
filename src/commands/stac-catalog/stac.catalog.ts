import { fsa } from '@chunkd/fs';
import { command, option, string } from 'cmd-ts';
import * as st from 'stac-ts';
import { logger } from '../../log.js';
import { config, registerCli, verbose } from '../common.js';

export const commandStacCatalog = command({
  name: 'stac-catalog',
  description: 'Construct STAC catalog',
  args: {
    config,
    verbose,
    template: option({
      type: string,
      long: 'template',
      description: 'JSON template file location for the Catalog metadata',
    }),
    output: option({ type: string, long: 'output', description: 'Output location for the catalog' }),
    collections: option({
      type: string,
      long: 'collections',
      description: 'Location of file containing collection.json paths',
    }),
  },

  handler: async (args) => {
    registerCli(args);

    logger.info('StacCatalogCreation:Start');

    const catalog: st.StacCatalog = await fsa.readJson(args.template);
    const collections: string[] = (await fsa.read(args.collections)).toString('utf8').split(/\r?\n/);
    catalog.links = createLinks(collections, catalog.links);
    await fsa.write(args.output, JSON.stringify(catalog));

    logger.info({ collectionId: catalog.id }, 'StacCatalogCreation:Done');
  },
});

export function createLinks(collections: string[], templateLinks: st.StacLink[]): st.StacLink[] {
  for (const coll of collections) {
    if (coll.includes('collection.json')) {
      const collLink: st.StacLink = {
        rel: 'child',
        href: coll,
      };
      templateLinks.push(collLink);
    }
  }
  return templateLinks;
}
