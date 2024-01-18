const combiningMacronCharacter = '\u0304';

export function slugify(input: string): string {
  return input.normalize('NFD').replaceAll(combiningMacronCharacter, '').toLowerCase();
}
