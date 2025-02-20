/**
 * @param input Human-readable string
 * @returns String slug. See src/utils/__test__/slugify.test.ts for examples.
 */
export function slugify(input: string): string {
  const result = removeDiacritics(input)
    .replaceAll("'", '')
    .replaceAll('ø', 'o')
    .replaceAll('Ø', 'O')
    .replaceAll(/[ ,/]/g, '-')
    .replaceAll('&', '-and-')
    .replaceAll(/--+/g, '-')
    .toLowerCase();

  const unhandledCharacters = result.match(/[^abcdefghijklmnopqrstuvwxyz0123456789_.-]/g);
  if (unhandledCharacters) {
    const sortedUniqueCharacters = Array.from(new Set(unhandledCharacters)).sort();
    const formattedCharacters = sortedUniqueCharacters.map((character) => {
      return JSON.stringify(character).replaceAll('\\\\', '\\');
    });
    throw Error(`Unhandled characters in input [${input}]: ${formattedCharacters.join(', ')}`, {
      cause: { characters: sortedUniqueCharacters },
    });
  }

  return result;
}

/**
 * Normalization form decomposition (NFD) splits characters like "ā" into their
 * [combining diacritical mark](https://www.unicode.org/charts/PDF/U0300.pdf) and the character which is being modified
 * by the diacritic. This way we can remove the macron from "ā", the accent from "é", and the like.
 */
function removeDiacritics(input: string): string {
  const combiningDiacriticalMarks = /[\u0300-\u036F]/g;
  return input.normalize('NFD').replaceAll(combiningDiacriticalMarks, '');
}
