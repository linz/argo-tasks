import type { BBox } from '@linzjs/geojson';

/** VLR, or EVLR with `evlr` */
function record(userId: string, recordId: number, data: Uint8Array, evlr = false): Uint8Array {
  const headerSize = evlr ? 60 : 54;
  const bytes = new Uint8Array(headerSize + data.length);
  const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode(userId), 2);
  view.setUint16(18, recordId, true);
  if (evlr) view.setBigUint64(20, BigInt(data.length), true);
  else view.setUint16(20, data.length, true);
  bytes.set(data, headerSize);
  return bytes;
}

/** GeoKeyDirectoryTag of `[id, value, location]` keys, location 0 by default */
export function geoKeys(keys: [number, number, number?][]): Uint8Array {
  const view = new DataView(new ArrayBuffer(8 + keys.length * 8));
  view.setUint16(6, keys.length, true);
  keys.forEach(([id, value, location = 0], i) => {
    view.setUint16(8 + i * 8, id, true);
    view.setUint16(10 + i * 8, location, true);
    view.setUint16(14 + i * 8, value, true);
  });
  return new Uint8Array(view.buffer);
}

/**
 * Fake LAS file without points, with a LASzip VLR and a CRS, unless `epsg` is null.
 * The CRS is a WKT VLR for LAS 1.4, or an EVLR after a COPC hierarchy EVLR with `evlr`, else GeoTIFF keys.
 */
export function fakeLasHeader(
  bbox: BBox,
  opts: {
    minor?: number;
    pointFormat?: number;
    count?: number;
    epsg?: number | null;
    vertical?: number | null;
    verticalDatum?: number;
    scale?: number;
    evlr?: boolean;
  } = {},
): Buffer {
  const minor = opts.minor ?? 4;
  const count = opts.count ?? 1_000;
  const epsg = opts.epsg === undefined ? 2193 : opts.epsg;
  const vertical = opts.vertical === undefined ? 7839 : opts.vertical;
  const datum = opts.verticalDatum ?? 1169;
  const headerSize = minor >= 4 ? 375 : minor === 3 ? 235 : 227;

  let crs: Uint8Array | undefined;
  if (epsg != null && minor >= 4) {
    const unit = 'UNIT["metre",1,AUTHORITY["EPSG","9001"]]';
    const projcs = `PROJCS["",GEOGCS["",AUTHORITY["EPSG","4167"]],${unit},AUTHORITY["EPSG","${epsg}"]]`;
    const vertcs = `VERT_CS["",VERT_DATUM["",2005,AUTHORITY["EPSG","${datum}"]],${unit},AUTHORITY["EPSG","${vertical}"]]`;
    const wkt = `${vertical == null ? projcs : `COMPD_CS["",${projcs},${vertcs}]`}\0`;
    crs = record('LASF_Projection', 2112, new TextEncoder().encode(wkt), opts.evlr);
  } else if (epsg != null) {
    const keys: [number, number][] = [[3072, epsg]];
    if (vertical != null) keys.push([4096, vertical], [4098, datum]);
    crs = record('LASF_Projection', 34735, geoKeys(keys));
  }
  const vlrs = [record('laszip encoded', 22204, new Uint8Array(34))];
  if (crs && !opts.evlr) vlrs.push(crs);
  const evlrs = crs && opts.evlr ? [record('copc', 1000, new Uint8Array(32), true), crs] : [];
  const pointOffset = headerSize + vlrs.reduce((size, v) => size + v.length, 0);

  const bytes = new Uint8Array(pointOffset + evlrs.reduce((size, v) => size + v.length, 0));
  const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode('LASF'));
  view.setUint8(24, 1);
  view.setUint8(25, minor);
  view.setUint16(94, headerSize, true);
  view.setUint32(96, pointOffset, true);
  view.setUint32(100, vlrs.length, true);
  view.setUint8(104, opts.pointFormat ?? 0x86);
  view.setUint32(107, minor >= 4 ? 0 : count, true);
  for (const offset of [131, 139, 147]) view.setFloat64(offset, opts.scale ?? 0.001, true);
  view.setFloat64(179, bbox[2], true);
  view.setFloat64(187, bbox[0], true);
  view.setFloat64(195, bbox[3], true);
  view.setFloat64(203, bbox[1], true);
  if (minor >= 4) {
    view.setBigUint64(235, BigInt(pointOffset), true);
    view.setUint32(243, evlrs.length, true);
    view.setBigUint64(247, BigInt(count), true);
  }
  let o = headerSize;
  for (const r of [...vlrs, ...evlrs]) {
    bytes.set(r, o);
    o += r.length;
  }
  return Buffer.from(bytes.buffer);
}
