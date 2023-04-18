import { fsa } from '@chunkd/fs';
import { command, option, restPositionals, string } from 'cmd-ts';
import * as st from 'stac-ts';
import { logger } from '../../log.js';
import { config, registerCli, verbose } from '../common.js';

export const commandStacCatalog = command({
  name: 'stac-catalog',
  description: 'Construct STAC catalog',
  args: {
    config,
    verbose,
    catalogId: option({ type: string, long: 'catalog-id', description: 'Catalog ID' }),
    output: option({ type: string, long: 'output', description: 'Output location for the catalog' }),
    collections: restPositionals({
      type: string,
      displayName: 'collections',
      description: 'List of collection file paths',
    }),
  },

  handler: async (args) => {
    registerCli(args);

    if (args.collections.length === 0) {
      logger.error('StacCatalogCreaton:Error:NoCollectionsProvided');
      process.exit(1);
    }

    logger.info('StacCatalogCreation:Start');

    const catalog: st.StacCatalog = {
      stac_version: '1.0.0',
      type: 'Catalog',
      id: args.catalogId,
      description: 'Catalog of linz-imagery',
      links: createLinks(args.collections, args.output),
    };

    await fsa.write(args.output, JSON.stringify(catalog));

    logger.info('StacCatalogCreation:Done');

    console.log(catalog);
  },
});

export function createLinks(collections: string[], catalogLocation: string): st.StacLink[] {
  let tempLinks: st.StacLink[] = [
    { rel: 'self', href: catalogLocation },
    { rel: 'root', href: catalogLocation },
  ];
  for (let coll of collections) {
    let collLink: st.StacLink = {
      rel: 'child',
      href: coll,
    };
    tempLinks.push(collLink);
  }
  return tempLinks as st.StacLink[];
}