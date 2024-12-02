import { StacItem } from 'stac-ts';

import { VersionedTiff } from '../mappers/group-by-map-code.js';
import { createBaseStacItem } from './create-base-stac-item.js';

/**
 * This function needs to create two groups:
 * - StacItem objects that will live in the "topo[50/250]" directory
 * - StacItem objects that will live in the "topo[50/250]-latest" directory
 *
 * All versions need a StacItem object that lives in the topo[50/250] directory
 * The latest version needs a second StacItem object that lives in the topo[50/250]-latest dir
 */
export async function createStacItemGroups(
  mapCode: string,
  latest: VersionedTiff,
  others: VersionedTiff[],
  target: URL,
  scale: string,
): Promise<{ latest: StacItem; all: StacItem[] }> {
  const latestStacItem = createBaseStacItem(mapCode, mapCode, latest.version, latest.tiff, latest.bounds);
  const allStacItems = [...others, latest].map(({ version, tiff, bounds }) =>
    createBaseStacItem(`${mapCode}_${version}`, mapCode, version, tiff, bounds),
  );

  // need to do the part where they add special fields to each group
  const latestURL = new URL(`${scale}/${mapCode}_${latest.version}.json`, target);

  // add link to all items pointing to the latest version
  allStacItems.forEach((item) => {
    item?.links.push({
      href: latestURL.href,
      rel: 'latest-version',
      type: 'application/json',
    });
  });

  // add link to the latest item referencing its copy that will live in the topo[50/250] directory
  latestStacItem.links.push({
    href: latestURL.href,
    rel: 'derived_from',
    type: 'application/json',
  });

  return { latest: latestStacItem, all: allStacItems };
}
