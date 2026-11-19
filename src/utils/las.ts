import { fsa } from '@chunkd/fs';
import type { BBox } from '@linzjs/geojson';

import { protocolAwareString } from './filelist.ts';

export interface LasHeader {
  source: URL;
  version: string;
  /** Point data record format, without the LAZ compression bits */
  pointFormat: number;
  pointCount: number;
  scale: [number, number, number];
  /** [minX, minY, maxX, maxY] */
  bbox: BBox;
}

/** Size of the LAS 1.4 public header block */
const LasHeaderSize = 375;

/** Size of the LAS 1.2 public header block */
const LasHeaderSizeMin = 227;

export function isPointCloud(url: URL): boolean {
  return /\.la[sz]$/i.test(url.pathname);
}

/** Read the public header block of a LAS, LAZ or COPC file. https://lasformat.org/latest/02.00_definition.html#public-header-block */
export async function readLasHeader(url: URL): Promise<LasHeader> {
  const bytes = await fsa.source(url).fetch(0, LasHeaderSize);
  const view = new DataView(bytes);
  const fail = (reason: string): never => {
    throw new Error(`${reason}: ${protocolAwareString(url)}`);
  };

  if (bytes.byteLength < LasHeaderSizeMin) fail('LAS header too short');
  if (new TextDecoder().decode(bytes.slice(0, 4)) !== 'LASF') fail('Not a LAS file');
  const major = view.getUint8(24);
  const minor = view.getUint8(25);
  if (major !== 1 || minor < 2) fail(`Unsupported LAS version ${major}.${minor}`);
  if (minor >= 4 && bytes.byteLength < LasHeaderSize) fail('LAS header too short');

  const pointCount = minor >= 4 ? Number(view.getBigUint64(247, true)) : view.getUint32(107, true);
  if (pointCount === 0) fail('LAS file has no points');

  return {
    source: url,
    version: `${major}.${minor}`,
    // LASzip compression bits https://github.com/LASzip/LASzip/blob/a446a0c01362ed1c642928cff30416217f0468c3/src/laszip_dll.cpp#L4260-L4267
    pointFormat: view.getUint8(104) & 0x3f,
    pointCount,
    scale: [view.getFloat64(131, true), view.getFloat64(139, true), view.getFloat64(147, true)],
    bbox: [
      view.getFloat64(187, true),
      view.getFloat64(203, true),
      view.getFloat64(179, true),
      view.getFloat64(195, true),
    ],
  };
}
