import type { Type } from 'cmd-ts';

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
 * Parse a date using relative times
 *
 * use for arguments like
 *  - `--since=23m` Since 23 minutes ago
 *  - `--until=30d` Until 30 days ago
 *
 * @example
 * "30s" // 30 seconds ago
 * "23m" // 23 minutes ago
 * "24h" // 24 hours ago
 * "90d" // 90 days ago
 */
export const RelativeDate: Type<string, Date> = {
  async from(s: string): Promise<Date> {
    // Support ISO dates, eg "2023-02-10" or "2023-02-10T12:00:00.000Z"
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d;

    const scale = s.toLowerCase().slice(-1);
    const digits = Number.parseInt(s.slice(0, -1));
    if (Number.isNaN(digits)) throw new Error(`Invalid date: ${s}`);

    const current = new Date();
    switch (scale) {
      case 's':
        current.setUTCSeconds(current.getUTCSeconds() - digits);
        return current;
      case 'm':
        current.setUTCMinutes(current.getUTCMinutes() - digits);
        return current;
      case 'h':
        current.setUTCHours(current.getUTCHours() - digits);
        return current;
      case 'd':
        current.setUTCDate(current.getUTCDate() - digits);
        return current;
    }
    throw new Error(`Unable to parse date from: ${s}`);
  },
};
