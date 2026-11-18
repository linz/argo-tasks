import type { BBox } from '@linzjs/geojson';

/** Fake LAS public header block */
export function fakeLasHeader(bbox: BBox, opts: { minor?: number; pointFormat?: number; count?: number } = {}): Buffer {
  const minor = opts.minor ?? 4;
  const count = opts.count ?? 1_000;
  const view = new DataView(new ArrayBuffer(375));
  new Uint8Array(view.buffer).set(new TextEncoder().encode('LASF'));
  view.setUint8(24, 1);
  view.setUint8(25, minor);
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
