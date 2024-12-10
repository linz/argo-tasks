import { Tiff } from '@cogeotiff/core';

import { logger } from '../../../log.js';
import { extractBounds, extractSize } from '../extractors/extract-bounds.js';
import { extractEpsgFromTiff } from '../extractors/extract-epsg-from-tiff.js';
import { extractMapCodeAndVersion } from '../extractors/extract-map-code-and-version.js';
import { brokenTiffs } from '../topo-stac-creation.js';
import { ByDirectory } from '../types/by-directory.js';
import { TiffItem } from '../types/tiff-item.js';

/**
 * We need to assign each tiff to a group based on its map code (e.g. "AT24").
 * For each group, we then need to identify the latest version and set it aside from the rest.
 * The latest version will have special metadata, whereas the rest will have similar metadata.
 *
 * @param tiffs: The tiffs to group by epsg, and map code
 * @returns a `ByDirectory<TiffItem>` promise
 */
export async function groupTiffsByDirectory(tiffs: Tiff[]): Promise<ByDirectory<TiffItem>> {
  // group the tiffs by directory, epsg, and map code
  const byDirectory = new ByDirectory<TiffItem>();

  // create items for each tiff and store them into 'all' by {epsg} and {map code}
  for (const tiff of tiffs) {
    const source = tiff.source.url;
    const { mapCode, version } = extractMapCodeAndVersion(source.href);

    const bounds = await extractBounds(tiff);
    const epsg = extractEpsgFromTiff(tiff);
    const size = extractSize(tiff);

    if (bounds == null || epsg == null || size == null) {
      if (bounds == null) {
        brokenTiffs.noBounds.push(`${mapCode}_${version}`);
        logger.warn({ mapCode, version }, 'Could not extract bounds from tiff');
      }

      if (epsg == null) {
        brokenTiffs.noEpsg.push(`${mapCode}_${version}`);
        logger.warn({ mapCode, version }, 'Could not extract epsg from tiff');
      }

      if (size == null) {
        brokenTiffs.noSize.push(`${mapCode}_${version}`);
        logger.warn({ mapCode, version }, 'Could not extract width or height from tiff');
      }

      continue;
    }

    const item = new TiffItem(tiff, source, mapCode, version, bounds, epsg, size);

    // push the item into 'all' by {epsg} and {map code}
    byDirectory.all.get(epsg.toString()).get(mapCode, []).push(item);
  }

  // for each {epsg} and {map code}, identify the latest item by {version} and copy it to 'latest'
  for (const [epsg, byMapCode] of byDirectory.all.entries()) {
    for (const [mapCode, items] of byMapCode.entries()) {
      const sortedItems = items.sort((a, b) => a.version.localeCompare(b.version));

      const latestItem = sortedItems[sortedItems.length - 1];
      if (latestItem == null) throw new Error();

      // store the item into 'latest' by {epsg} and {map code}
      byDirectory.latest.get(epsg).set(mapCode, latestItem);
    }
  }

  logger.info(
    byDirectory.all.entries().reduce((obj, [epsg, byMapCode]) => {
      return { ...obj, [epsg]: byMapCode.entries().length };
    }, {}),
    'numItemsPerEpsg',
  );

  return byDirectory;
}
