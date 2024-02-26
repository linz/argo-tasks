export function randomEnumValue<T extends object>(enumInstance: T): T[keyof T] {
  const values = Object.values(enumInstance);
  return randomArrayEntry(values);
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
