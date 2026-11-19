import type { BBox } from '@linzjs/geojson';

/** Fake LAS public header block with a WKT VLR, without it when `epsg` is null */
export function fakeLasHeader(
  bbox: BBox,
  opts: {
    minor?: number;
    pointFormat?: number;
    count?: number;
    epsg?: number | null;
    vertical?: number | null;
    verticalDatum?: number;
  } = {},
): Buffer {
  const minor = opts.minor ?? 4;
  const count = opts.count ?? 1_000;
  const epsg = opts.epsg === undefined ? 2193 : opts.epsg;
  const vertical = opts.vertical === undefined ? 7839 : opts.vertical;
  const projcs = `PROJCS["",GEOGCS["",AUTHORITY["EPSG","4167"]],AUTHORITY["EPSG","${epsg}"]]`;
  const vertcs = `VERT_CS["",VERT_DATUM["",2005,AUTHORITY["EPSG","${opts.verticalDatum ?? 1169}"]],AUTHORITY["EPSG","${vertical}"]]`;
  const wkt = new TextEncoder().encode(
    epsg == null ? '' : `${vertical == null ? projcs : `COMPD_CS["",${projcs},${vertcs}]`}\0`,
  );
  const vlrSize = wkt.length > 0 ? 54 + wkt.length : 0;
  const view = new DataView(new ArrayBuffer(375 + vlrSize));
  const bytes = new Uint8Array(view.buffer);
  bytes.set(new TextEncoder().encode('LASF'));
  view.setUint8(24, 1);
  view.setUint8(25, minor);
  view.setUint16(94, 375, true);
  view.setUint32(96, 375 + vlrSize, true);
  if (vlrSize > 0) {
    view.setUint32(100, 1, true);
    bytes.set(new TextEncoder().encode('LASF_Projection'), 375 + 2);
    view.setUint16(375 + 18, 2112, true);
    view.setUint16(375 + 20, wkt.length, true);
    bytes.set(wkt, 375 + 54);
  }
  view.setUint8(104, opts.pointFormat ?? 0x86);
  view.setUint32(107, minor >= 4 ? 0 : count, true);
  for (const offset of [131, 139, 147]) view.setFloat64(offset, 0.001, true);
  view.setFloat64(179, bbox[2], true);
  view.setFloat64(187, bbox[0], true);
  view.setFloat64(195, bbox[3], true);
  view.setFloat64(203, bbox[1], true);
  if (minor >= 4) view.setBigUint64(247, BigInt(count), true);
  return Buffer.from(view.buffer);
}
