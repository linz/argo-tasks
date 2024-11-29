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
