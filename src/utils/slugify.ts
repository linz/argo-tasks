const unhandledCharactersRegExp = /[^abcdefghijklmnopqrstuvwxyz0123456789_.-]/g;

const combiningDiacriticalMarks = /[\u0300-\u036F]/g;

function removeDiacritics(input: string): string {
  /*
   Normalization form decomposition (NFD) splits characters like into their
   [combining diacritical mark](https://www.unicode.org/charts/PDF/U0300.pdf) and the character which is being modified
   by the diacritic. This way we can remove the macron from "ā", the accent from "é", and the like.
   */
  return input.normalize('NFD').replaceAll(combiningDiacriticalMarks, '');
}

class UnhandledCharactersError extends Error {
  public characters: string[];

  constructor(characters: string[]) {
    const formattedCharacters = characters.map((character) => {
      return JSON.stringify(character).replaceAll('\\\\', '\\');
    });
    super(`Unhandled characters: ${formattedCharacters.join(', ')}`);
    this.name = 'UnhandledCharactersError';
    this.characters = characters;
  }
}

export function slugify(input: string): string {
  const result = removeDiacritics(input).replaceAll(' ', '-').toLowerCase();

  const unhandledCharacters = result.match(unhandledCharactersRegExp);
  if (unhandledCharacters) {
    const sortedUniqueCharacters = Array.from(new Set(unhandledCharacters)).sort();
    throw new UnhandledCharactersError(sortedUniqueCharacters);
  }

  return result;
}
