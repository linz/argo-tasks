/**
 * Convert time zone-aware date/time string to Pacific/Auckland time zone string
 *
 * @param dateTimeString Optional date/time string which can be parsed by the `Date` constructor
 * @returns Localised date/time string eg "2024-01-01", or `undefined` if the input is
 * missing or cannot be parsed into a valid date
 *
 */
export function getPacificAucklandYearMonthDay(dateTimeString?: string | null): string | undefined {
  if (dateTimeString == null) return;

  const date = new Date(dateTimeString);
  // An unparseable string gives an "Invalid Date"; return undefined rather than a corrupt slice
  if (Number.isNaN(date.getTime())) return;

  // "sv-SE" formats date times as "yyyy-MM-dd hh:mm:ss"
  const pacificAucklandDateTimeString = date.toLocaleString('sv-SE', {
    timeZone: 'Pacific/Auckland',
  });

  return pacificAucklandDateTimeString.slice(0, 10);
}
