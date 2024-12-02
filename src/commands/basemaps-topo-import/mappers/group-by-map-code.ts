import { Bounds } from '@basemaps/geo';
import { Tiff } from '@cogeotiff/core';

import { extractBounds } from '../extractors/extract-bounds.js';
import { extractMapCodeAndVersion } from '../extractors/extract-map-code-and-version.js';
import { brokenTiffs } from '../topo-stac-creation.js';

export interface VersionedTiff {
  version: string;
  tiff: Tiff;
  bounds: Bounds;
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
    const source = tiff.source.url.href;
    const { mapCode, version } = extractMapCodeAndVersion(source);

    const bounds = await extractBounds(tiff);
    if (bounds == null) {
      brokenTiffs.set(`${mapCode}_${version}`, tiff);
      continue;
    }

    const entry = versionsByMapCode.get(mapCode);

    if (entry == null) {
      versionsByMapCode.set(mapCode, [{ version, tiff, bounds }]);
    } else {
      entry.push({ version, tiff, bounds });
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
