import { EpsgCode } from '@basemaps/geo';

import { logger } from '../../../log.js';

const slugs: { [key in EpsgCode]?: string } = {
  [EpsgCode.Nztm2000]: 'new-zealand-mainland',
  [EpsgCode.Citm2000]: 'chatham-islands',
};

/**
 * Attempts to map the given EpsgCode enum to a slug.
 *
 * @param epsg: The EpsgCode enum to map to a slug
 *
 * @returns if succeeded, a slug string. Otherwise, null.
 */
export function mapEpsgToSlug(epsg: EpsgCode): string | null {
  const slug = slugs[epsg];

  if (slug == null) {
    logger.info({ found: false }, 'mapEpsgToSlug()');
    return null;
  }

  logger.info({ found: true }, 'mapEpsgToSlug()');
  return slug;
}
