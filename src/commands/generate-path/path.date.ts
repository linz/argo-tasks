import type { StacCollection } from 'stac-ts';

/**
 * Format a STAC collection as a "startYear-endYear" or "startYear" in Pacific/Auckland time
 *
 * @param collection STAC collection to format
 * @returns the formatted termporal extent
 */
export function formatDate(collection: StacCollection): string {
  const interval = collection.extent?.temporal?.interval?.[0];
  const startYear = getPacificAucklandYear(interval[0]);
  const endYear = getPacificAucklandYear(interval[1]);

  if (startYear == null || endYear == null) throw new Error(`Missing datetime in interval: ${interval.join(', ')}`);
  if (startYear === endYear) return startYear;
  return `${startYear}-${endYear}`;
}

/**
 * Convert time zone-aware date/time string to Pacific/Auckland time zone string
 *
 * @param dateTimeString Optional date/time string which can be parsed by the `Date` constructor
 * @returns Localised date/time string eg "2024-01-01"
 *
 */
export function getPacificAucklandYearMonthDay(dateTimeString?: string | null): string | undefined {
  if (dateTimeString == null) return;

  // "sv-SE" formats date times as "yyyy-MM-dd hh:mm:ss"
  const pacificAucklandDateTimeString = new Date(dateTimeString).toLocaleString('sv-SE', {
    timeZone: 'Pacific/Auckland',
  });

  return pacificAucklandDateTimeString.slice(0, 10);
}

/**
 * Format a time as a year in Pacific/Auckland
 *
 * @param dateTimeString
 * @returns Formatted time as eg "2024"
 */
export function getPacificAucklandYear(dateTimeString?: string | null): string | undefined {
  return getPacificAucklandYearMonthDay(dateTimeString)?.slice(0, 4);
}
