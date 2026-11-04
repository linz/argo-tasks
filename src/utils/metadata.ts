export interface StacCollectionLinz {
  'linz:lifecycle': string;
  'linz:geospatial_category': GeospatialDataCategory;
  'linz:region': string;
  'linz:slug': string;
  'linz:security_classification': string;
  'linz:event_name'?: string;
  'linz:geographic_description'?: string;
  gsd?: number;
  data_type?: string;
}

export const GeospatialDataCategories = {
  AncillaryAerialPhotos: 'ancillary-aerial-photos',
  AncillaryNearInfraredAerialPhotos: 'ancillary-near-infrared-aerial-photos',
  NearInfraredAerialPhotos: 'near-infrared-aerial-photos',
  NearInfraredSatelliteImagery: 'near-infrared-satellite-imagery',
  RuralAerialPhotos: 'rural-aerial-photos',
  SatelliteImagery: 'satellite-imagery',
  ScannedAerialPhotos: 'scanned-aerial-photos',
  UrbanAerialPhotos: 'urban-aerial-photos',
  Dem: 'dem',
  Dsm: 'dsm',
  DemHillshade: 'dem-hillshade',
  DemHillshadeIgor: 'dem-hillshade-igor',
  DsmHillshade: 'dsm-hillshade',
  DsmHillshadeIgor: 'dsm-hillshade-igor',
} as const;

export type GeospatialDataCategory = (typeof GeospatialDataCategories)[keyof typeof GeospatialDataCategories];

export const RgbCategories: ReadonlySet<GeospatialDataCategory> = new Set([
  GeospatialDataCategories.AncillaryAerialPhotos,
  GeospatialDataCategories.RuralAerialPhotos,
  GeospatialDataCategories.SatelliteImagery,
  GeospatialDataCategories.ScannedAerialPhotos,
  GeospatialDataCategories.UrbanAerialPhotos,
]);

/**
 * nz-coastal ancillary imagery follows the elevation layout:
 * GSD goes in the product folder (e.g. rgb_0.3m) instead of the slug.
 */
export function isCoastalAncillary(targetBucketName: string | undefined, category: string): boolean {
  return (
    targetBucketName === 'nz-coastal' &&
    (category === GeospatialDataCategories.AncillaryAerialPhotos ||
      category === GeospatialDataCategories.AncillaryNearInfraredAerialPhotos)
  );
}
