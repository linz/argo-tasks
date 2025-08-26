import { fsa } from '@chunkd/fs';
import { command, option, positional } from 'cmd-ts';
import type * as st from 'stac-ts';

import { CliInfo } from '../../cli.info.ts';
import { logger } from '../../log.ts';
import { makeRelative } from '../../utils/filelist.ts';
import { hashBuffer } from '../../utils/hash.ts';
import { config, registerCli, Url, UrlFolder, verbose } from '../common.ts';

const StacFileExtensionUrl = 'https://stac-extensions.github.io/file/v2.1.0/schema.json';

export const commandStacCatalog = command({
  name: 'stac-catalog',
  description: 'Construct STAC catalog',
  version: CliInfo.version,
  args: {
    config,
    verbose,
    template: option({
      type: Url,
      long: 'template',
      description: 'JSON template file location for the Catalog metadata',
    }),
    output: option({ type: Url, long: 'output', description: 'Output location for the catalog' }),
    path: positional({ type: UrlFolder, description: 'Location to search for collection.json paths' }),
  },

  async handler(args) {
    registerCli(this, args);
    logger.info('StacCatalogCreation:Start');
    const catalog = await fsa.readJson<st.StacCatalog>(args.template);
    if (catalog.stac_extensions == null) catalog.stac_extensions = [];
    // Add the file extension for "file:checksum" the links
    if (!catalog.stac_extensions.includes(StacFileExtensionUrl)) {
      catalog.stac_extensions.push(StacFileExtensionUrl);
    }

    const templateLinkCount = catalog.links.length;

    catalog.links = await createLinks(args.path, catalog.links);

    await fsa.write(args.output, JSON.stringify(catalog, null, 2));
    logger.info(
      { catalogId: catalog.id, collections: catalog.links.length - templateLinkCount },
      'StacCatalogCreation:Done',
    );
  },
});

export async function createLinks(basePath: URL, templateLinks: st.StacLink[]): Promise<st.StacLink[]> {
  const collections = await fsa.toArray(fsa.list(basePath));

  for (const coll of collections) {
    if (coll.pathname.endsWith('/collection.json')) {
      const relPath = makeRelative(basePath, coll);
      const buf = await fsa.read(coll);
      const collection = JSON.parse(buf.toString()) as st.StacCollection;
      const checksum = hashBuffer(buf);
      const collLink: st.StacLink = {
        rel: 'child',
        href: relPath,
        title: collection.title,
        'file:checksum': checksum,
        'file:size': buf.length,
      };
      templateLinks.push(collLink);
    }
  }
  return templateLinks;
}
