import { describe, it } from 'node:test';

import assert from 'assert';

import { getPacificAucklandYearMonthDay, RelativeDate } from '../date.ts';

describe('getPacificAucklandYearMonthDay', () => {
  it('should format as yyyy-mm-dd', () => {
    assert.equal(getPacificAucklandYearMonthDay('2012-12-31T11:00:00Z'), '2013-01-01');
    assert.equal(getPacificAucklandYearMonthDay('2012-12-31T10:59:59Z'), '2012-12-31');
    assert.equal(getPacificAucklandYearMonthDay('2012-06-15T11:59:59Z'), '2012-06-15');
    assert.equal(getPacificAucklandYearMonthDay('2012-06-15T12:00:00Z'), '2012-06-16');
  });
});

describe('relativeDateParser', () => {
  const OneMinuteMs = 60 * 1000;
  const OneHourMs = 60 * OneMinuteMs;
  const OneDayMs = 24 * OneHourMs;

  it('should parse ISO Dates', async () => {
    assert.equal((await RelativeDate.from('2023-02-10T00:00:00.000Z')).toISOString(), '2023-02-10T00:00:00.000Z');
    assert.equal((await RelativeDate.from('2023-02-10')).toISOString(), '2023-02-10T00:00:00.000Z');
  });

  it('should parse known formats', async () => {
    const parseTime = (s: string): Promise<number> => RelativeDate.from(s).then((f) => f.getTime());

    // Validate times are approximatly the same
    const approxEqual = (a: number, b: number, diff: number): void => assert.ok(Math.abs(a - b) < diff);

    approxEqual(await parseTime('23m'), new Date(new Date().getTime() - OneMinuteMs * 23).getTime(), OneMinuteMs);
    approxEqual(await parseTime('23M'), new Date(new Date().getTime() - OneMinuteMs * 23).getTime(), OneMinuteMs);

    approxEqual(await parseTime('23h'), new Date(new Date().getTime() - OneHourMs * 23).getTime(), OneMinuteMs);
    approxEqual(await parseTime('23H'), new Date(new Date().getTime() - OneHourMs * 23).getTime(), OneMinuteMs);

    approxEqual(await parseTime('23d'), new Date(new Date().getTime() - OneDayMs * 23).getTime(), OneHourMs);
    approxEqual(await parseTime('23D'), new Date(new Date().getTime() - OneDayMs * 23).getTime(), OneHourMs);
  });

  it('should error with invalid formats', async () => {
    const parseError = (s: string): Promise<string> =>
      RelativeDate.from(s)
        .then(String)
        .catch((f) => String(f));

    assert.equal(await parseError('23Z'), 'Error: Unable to parse date from: 23Z');
    assert.equal(await parseError('abc'), 'Error: Invalid date: abc');
  });
});
