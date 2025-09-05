import type { Tiff, TiffImage } from '@cogeotiff/core';
import { SampleFormat, TiffTag } from '@cogeotiff/core';

import { protocolAwareString } from './filelist.ts';

function getDataType(i: SampleFormat): string {
  switch (i) {
    case SampleFormat.Uint:
      return 'uint';
    case SampleFormat.Int:
      return 'int';
    case SampleFormat.Float:
      return 'float';
    case SampleFormat.Void:
      return 'void';
    case SampleFormat.ComplexFloat:
      return 'cfloat';
    case SampleFormat.ComplexInt:
      return 'cint';
    default:
      return 'unknown';
  }
}
/**
 * Load the band information from a tiff and return it as a array of human friendly names
 *
 * @example
 * `[uint16, uint16, uint16]` 3 band uint16
 *
 * @param tiff Tiff to extract band information from
 * @returns list of band information
 * @throws {Error} if cannot extract band information
 */
export async function extractBandInformation(tiff: Tiff): Promise<string[]> {
  const firstImage = tiff.images[0] as TiffImage;

  const [dataType, bitsPerSample] = await Promise.all([
    /** firstImage.fetch(TiffTag.Photometric), **/ // TODO enable RGB detection
    firstImage.fetch(TiffTag.SampleFormat),
    firstImage.fetch(TiffTag.BitsPerSample),
  ]);

  if (bitsPerSample == null) {
    throw new Error(`Failed to extract band information from: ${protocolAwareString(tiff.source.url)}`);
  }

  if (dataType && dataType.length !== bitsPerSample.length) {
    throw new Error(`Datatype and bits per sample miss match: ${protocolAwareString(tiff.source.url)}`);
  }

  const imageBands: string[] = [];
  for (let i = 0; i < bitsPerSample.length; i++) {
    const type = getDataType(dataType ? (dataType[i] as SampleFormat) : SampleFormat.Uint);
    const bits = bitsPerSample[i];
    imageBands.push(`${type}${bits}`);
  }

  return imageBands;
}
