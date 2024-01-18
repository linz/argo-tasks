const combiningDiacriticalMarks = /[\u0300-\u036F]/g;

function removeDiacritics(input: string): string {
  /*
   Normalization form decomposition (NFD) splits characters like into their
   [combining diacritical mark](https://www.unicode.org/charts/PDF/U0300.pdf) and the character which is being modified
   by the diacritic. This way we can remove the macron from "ā", the accent from "é", and the like.
   */
  return input.normalize('NFD').replaceAll(combiningDiacriticalMarks, '');
}

export function slugify(input: string): string {
  return removeDiacritics(input).replaceAll(' ', '-').toLowerCase();
}
