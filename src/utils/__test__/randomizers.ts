type EnumObject = { [key: string]: number | string };

/**
 * Get a single random value from an enum with integer values.
 *
 * @param enumeration
 */
export function randomEnumValue<E extends EnumObject>(enumeration: E): number {
  const keysAndValues = Object.values(enumeration)
    .map((key) => Number(enumeration[key]))
    .filter((key) => Number.isInteger(key));
  return randomArrayEntry(keysAndValues);
}

/**
 * Get a single random entry from a set
 *
 * @param values Set
 */
export function randomSetEntry<T>(values: Set<T>): T {
  const valuesArray = Array.from(values);
  return randomArrayEntry(valuesArray);
}

export function randomArrayEntry<T>(values: T[]): T {
  return values[Math.floor(Math.random() * values.length)]!;
}

export function anyAsciiPrintableString(): string {
  return randomString(
    ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~',
    10,
  );
}

export function anyAsciiAlphanumeric(): string {
  return randomString('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 10);
}

/**
 * Create a random string of a fixed length composed of characters from an alphabet
 *
 * @param alphabetString
 * @param length
 */
export function randomString(alphabetString: string, length: number): string {
  let result = '';
  for (let counter = 0; counter < length; counter++) {
    result += alphabetString.charAt(Math.floor(Math.random() * alphabetString.length));
  }
  return result;
}
