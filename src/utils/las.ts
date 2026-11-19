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
  /** Horizontal CRS from the WKT or GeoTIFF keys VLR */
  epsg?: number;
}

/** Variable length record https://lasformat.org/latest/02.00_definition.html#variable-length-records-vlrs */
export interface LasVlr {
  userId: string;
  recordId: number;
  description: string;
  data: ArrayBuffer;
}

/** GeoKeyDirectoryTag (34735) entry https://docs.ogc.org/is/19-008r4/19-008r4.html#_requirements_class_geokeydirectorytag */
export interface GeoKey {
  id: number;
  location: number;
  count: number;
  value: number;
}

/** Size of the LAS 1.4 public header block */
const LasHeaderSize = 375;

/** Size of the LAS 1.2 public header block */
const LasHeaderSizeMin = 227;

const VlrHeaderSize = 54;

function text(bytes: ArrayBuffer, offset: number, length: number): string {
  return new TextDecoder().decode(new Uint8Array(bytes, offset, length)).replace(/\0.*$/s, '');
}

/** Split the bytes between the public header and the point data into VLRs */
export function parseVlrs(bytes: ArrayBuffer, count: number): LasVlr[] {
  const view = new DataView(bytes);
  const vlrs: LasVlr[] = [];
  for (let i = 0, o = 0; i < count && o + VlrHeaderSize <= bytes.byteLength; i++) {
    const length = view.getUint16(o + 20, true);
    vlrs.push({
      userId: text(bytes, o + 2, 16),
      recordId: view.getUint16(o + 18, true),
      description: text(bytes, o + 22, 32),
      data: bytes.slice(o + VlrHeaderSize, o + VlrHeaderSize + length),
    });
    o += VlrHeaderSize + length;
  }
  return vlrs;
}

export function parseGeoKeys(data: ArrayBuffer): GeoKey[] {
  const view = new DataView(data);
  return Array.from({ length: view.getUint16(6, true) }, (_, i) => ({
    id: view.getUint16(8 + i * 8, true),
    location: view.getUint16(10 + i * 8, true),
    count: view.getUint16(12 + i * 8, true),
    value: view.getUint16(14 + i * 8, true),
  }));
}

/** EPSG code of the projected CRS in WKT1 or WKT2, eg the PROJCS of a COMPD_CS */
export function wktEpsg(wkt: string): number | undefined {
  const start = wkt.search(/PROJ(CS|CRS)\[/);
  if (start < 0) return undefined;
  let depth = 0;
  let quoted = false;
  let end = start;
  for (; end < wkt.length; end++) {
    const c = wkt[end];
    if (c === '"') quoted = !quoted;
    else if (!quoted && c === '[') depth++;
    else if (!quoted && c === ']' && --depth === 0) break;
  }
  const code = [...wkt.slice(start, end).matchAll(/(?:AUTHORITY|ID)\["EPSG",\s*"?(\d+)"?\]/g)].at(-1)?.[1];
  return code == null ? undefined : Number(code);
}

/** Horizontal EPSG code from the WKT (2112) or GeoTIFF keys (34735) VLR */
export function lasEpsg(vlrs: LasVlr[]): number | undefined {
  const find = (id: number): ArrayBuffer | undefined =>
    vlrs.find((v) => v.userId === 'LASF_Projection' && v.recordId === id)?.data;
  const wkt = find(2112);
  const fromWkt = wkt && wktEpsg(text(wkt, 0, wkt.byteLength));
  if (fromWkt) return fromWkt;
  const keys = find(34735);
  const projected = keys && parseGeoKeys(keys).find((k) => k.id === 3072 && k.location === 0);
  return projected && projected.value !== 32767 ? projected.value : undefined;
}

export function isPointCloud(url: URL): boolean {
  return /\.la[sz]$/i.test(url.pathname);
}

/** Read the public header block and CRS of a LAS, LAZ or COPC file. https://lasformat.org/latest/02.00_definition.html#public-header-block */
export async function readLasHeader(url: URL): Promise<LasHeader> {
  const source = fsa.source(url);
  const bytes = await source.fetch(0, LasHeaderSize);
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
  if (pointCount === 0) fail('LAS file has no points, was it clipped empty?');

  const headerSize = view.getUint16(94, true);
  const vlrCount = view.getUint32(100, true);
  const vlrBytes = view.getUint32(96, true) - headerSize;
  const vlrs = vlrCount > 0 && vlrBytes > 0 ? parseVlrs(await source.fetch(headerSize, vlrBytes), vlrCount) : [];

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
    epsg: lasEpsg(vlrs),
  };
}
