import { fsa } from '@chunkd/fs';
import { command, option, positional, string } from 'cmd-ts';
import { isAbsolute, resolve } from 'path';
import * as st from 'stac-ts';
import { logger } from '../../log.js';
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
 * /home/blaha + /home/blacha/index.json => ./index.json
 *
 * @param basePath path to make relative to
 * @param filePath target file
 * @returns relative path to file
 */
export function makeRelative(basePath: string, filePath: string): string {
  if (isUrl(filePath) || isAbsolute(filePath)) {
    if (!filePath.startsWith(basePath)) {
      throw new Error(`FilePaths are not relative base: ${basePath} file: ${filePath}`);
    }
    return filePath.slice(basePath.length);
  }
  return filePath;
}

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
    path: positional({ type: string, description: 'Location to search for collection.json paths' }),
  },

  handler: async (args) => {
    registerCli(args);

    logger.info('StacCatalogCreation:Start');

    const catalog = await fsa.readJson<st.StacCatalog>(args.template);

    const templateLinkCount = catalog.links.length;

    catalog.links = await createLinks(args.path, catalog.links);

    await fsa.write(args.output, JSON.stringify(catalog));
    logger.info(
      { catalogId: catalog.id, collections: catalog.links.length - templateLinkCount },
      'StacCatalogCreation:Done',
    );
  },
});

export async function createLinks(basePath: string, templateLinks: st.StacLink[]): Promise<st.StacLink[]> {
  const collections = await fsa.toArray(fsa.list(basePath));

  for (const coll of collections) {
    if (coll.endsWith('/collection.json')) {
      const relPath = makeRelative(basePath, coll);
      const collection = await fsa.readJson<st.StacCollection>(coll);
      const collLink: st.StacLink = {
        rel: 'child',
        href: fsa.join('./', relPath),
        title: collection.title,
      };
      templateLinks.push(collLink);
    }
  }
  return templateLinks;
}
