import { createFileStats } from '@basemaps/cogify/build/cogify/stac.js';
import { Bounds, Epsg, Projection } from '@basemaps/geo';
import { fsa } from '@basemaps/shared';
import { Tiff } from '@cogeotiff/core';

import { extractBounds } from '../extractors/extract-bounds.js';
import { extractEpsgFromTiff } from '../extractors/extract-epsg-from-tiff.js';
import { extractMapCodeAndVersion } from '../extractors/extract-map-code-and-version.js';
import { brokenTiffs } from '../topo-stac-creation.js';

export interface FileStats {
  'file:size': number;
  'file:checksum': string;
}

export interface VersionedTiff {
  version: string;
  tiff: Tiff;
  stats: FileStats;
  epsg: Epsg;
  bounds: Bounds;
  source: string;
}

type VersionsByMapCode = Map<string, VersionedTiff[]>;
export type GroupsByMapCode = Map<string, { latest: VersionedTiff; others: VersionedTiff[] }>;

/**
 * We need to assign each tiff to a group based on its map code (e.g. "AT24").
 * For each group, we then need to identify the latest version and set it aside from the rest.
 * The latest version will have special metadata, whereas the rest will have similar metadata.
 *
 * @param tiffs: The tiffs to group by map code and version
 * @returns a `GroupsByMapCode` Map object
 */
export async function groupTiffsByMapCodeAndLatest(tiffs: Tiff[]): Promise<GroupsByMapCode> {
  // group the tiffs by map code and version
  //
  // {
  //   "AT24": [
  //     { version: "v1-00", tiff: Tiff },
  //     { version: "v1-01", tiff: Tiff },
  //     ...
  //   ],
  //   "AT25": [
  //     { version: "v1-00", tiff: Tiff },
  //     { version: "v2-00", tiff: Tiff },
  //     ...
  //   ]
  // }
  const versionsByMapCode: VersionsByMapCode = new Map();

  for (const tiff of tiffs) {
    // extract the epsg code from the Tiff object
    const epsg = extractEpsgFromTiff(tiff);
    const projection = Projection.tryGet(epsg);
    if (projection == null) throw new Error(`Could not find a projection for epsg:${epsg.code}`);

    const source = tiff.source.url.href;
    const { mapCode, version } = extractMapCodeAndVersion(source);

    const bounds = await extractBounds(tiff);
    if (bounds == null) {
      brokenTiffs.set(`${mapCode}_${version}`, tiff);
      continue;
    }
    const entry = versionsByMapCode.get(mapCode);

    // Get tiff check sum
    const buffer = await fsa.read(tiff.source.url);
    const stats = createFileStats(buffer);

    // Convert bounds to WGS84 for different source epsg
    const boundsCoverted = Bounds.fromBbox(projection.boundsToWgs84BoundingBox(bounds));

    if (entry == null) {
      versionsByMapCode.set(mapCode, [{ version, tiff, bounds: boundsCoverted, stats, epsg, source }]);
    } else {
      entry.push({ version, tiff, bounds: boundsCoverted, stats, epsg, source });
    }
  }

  // for each group, identify the latest version
  //
  // {
  //   "AT24": {
  //     latest: { version: "v1-01", tiff: Tiff },
  //     others: [
  //       { version: "v1-00", tiff: Tiff },
  //       ...
  //     ]
  //   },
  //   "AT25": {
  //     latest: { version: "v2-00", tiff: Tiff },
  //     others: [
  //       { version: "v1-00", tiff: Tiff },
  //       ...
  //     ]
  //   }
  // }
  const groupsByMapCode: GroupsByMapCode = new Map();

  for (const [mapCode, versions] of versionsByMapCode.entries()) {
    const sorted = versions.sort((a, b) => a.version.localeCompare(b.version));

    const latest = sorted[sorted.length - 1];
    if (latest == null) throw new Error();

    const others = sorted.filter((version) => version !== latest);

    groupsByMapCode.set(mapCode, { latest, others });
  }

  return groupsByMapCode;
}
