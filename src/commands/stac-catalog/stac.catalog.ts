import { fsa } from '@chunkd/fs';
import { command, option, positional } from 'cmd-ts';
import { createHash } from 'crypto';
import path from 'path';
import * as st from 'stac-ts';

import { CliInfo } from '../../cli.info.js';
import { logger } from '../../log.js';
import { UrlParser } from '../../utils/parsers.js';
import { config, registerCli, verbose } from '../common.js';

/** is a path a URL */
export function isUrl(path: string): boolean {
  try {
    new URL(path);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Convert a path to relative
 *
 * https://foo.com + https://foo.com/bar.html => ./bar.html
 * s3://foo/ + s3://foo/bar/baz.html => ./bar/baz.html
 * /home/blacha + /home/blacha/index.json => ./index.json
 *
 * @param basePath path to make relative to
 * @param filePath target file
 * @returns relative path to file
 */
export function makeRelative(basePath: URL, filePath: URL): string {
  if (filePath.host !== basePath.host) {
    throw new Error(`Relative host mismatch "${basePath.href}" vs "${filePath.href}"`);
  }
  if (filePath.protocol !== basePath.protocol) {
    throw new Error(`Relative protocol mismatch "${basePath.href}" vs "${filePath.href}"`);
  }

  const relPath = path.relative(basePath.href, filePath.href);
  if (!relPath.startsWith('.')) return './' + relPath;
  return relPath;
}

const StacFileExtensionUrl = 'https://stac-extensions.github.io/file/v2.1.0/schema.json';

export const commandStacCatalog = command({
  name: 'stac-catalog',
  description: 'Construct STAC catalog',
  version: CliInfo.version,
  args: {
    config,
    verbose,
    template: option({
      type: UrlParser,
      long: 'template',
      description: 'JSON template file location for the Catalog metadata',
    }),
    output: option({ type: UrlParser, long: 'output', description: 'Output location for the catalog' }),
    path: positional({
      type: UrlParser,
      description: 'Location to search for collection.json paths',
    }),
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

export async function createLinks(baseUrl: URL, templateLinks: st.StacLink[]): Promise<st.StacLink[]> {
  const collections = await fsa.toArray(fsa.list(baseUrl));

  for (const coll of collections) {
    if (coll.href.endsWith('/collection.json')) {
      const buf = await fsa.read(coll);
      const collection = JSON.parse(buf.toString()) as st.StacCollection;
      // Muktihash header 0x12 - Sha256 0x20 - 32 bits of hex digest
      const checksum = '1220' + createHash('sha256').update(buf).digest('hex');
      const collLink: st.StacLink = {
        rel: 'child',
        href: makeRelative(baseUrl, coll),
        title: collection.title,
        'file:checksum': checksum,
        'file:size': buf.length,
      };
      templateLinks.push(collLink);
    }
  }
  return templateLinks;
}
