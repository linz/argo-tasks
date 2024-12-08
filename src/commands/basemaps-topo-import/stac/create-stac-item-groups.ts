import { StacItem } from 'stac-ts';

import { TiffItem } from '../types/tiff-item.js';
import { createBaseStacItem } from './create-base-stac-item.js';

/**
 * This function needs to create two groups:
 * - StacItem objects that will live in the "topo[50/250]" directory
 * - StacItem objects that will live in the "topo[50/250]-latest" directory
 *
 * All versions need a StacItem object that lives in the topo[50/250] directory
 * The latest version needs a second StacItem object that lives in the topo[50/250]-latest dir
 */
export async function createStacItemPair(
  scale: string,
  mapCode: string,
  all: TiffItem[],
  latest: TiffItem,
): Promise<{ latest: { item: TiffItem; stac: StacItem }; all: { item: TiffItem; stac: StacItem }[] }> {
  const latestStacItem = { item: latest, stac: createBaseStacItem(mapCode, mapCode, latest) };
  const allStacItems = all.map((tiffItem) => ({
    item: tiffItem,
    stac: createBaseStacItem(`${mapCode}_${tiffItem.version}`, mapCode, tiffItem),
  }));

  // add link to all items pointing to the latest version
  allStacItems.forEach((pair) => {
    pair.stac?.links.push({
      href: `./${mapCode}_${latest.version}.json`,
      rel: 'latest-version',
      type: 'application/json',
    });
  });

  // add link to the latest item referencing its copy that will live in the topo[50/250] directory
  latestStacItem.stac.links.push({
    href: `../${scale}/${mapCode}_${latest.version}.json`,
    rel: 'derived_from',
    type: 'application/json',
  });

  return { latest: latestStacItem, all: allStacItems };
}
