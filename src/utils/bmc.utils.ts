// Capitalize first letter of a string
const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Vector image name usually is lower cases or the layer name from lds, we need titlized that for titles in config
 * topographic -> Topographic
 * 53382-nz-roads-addressing -> 53382 NZ Road Addressing
 */
export function titleizeVectorName(input: string): string {
  const splits = input.split('-');
  for (const [index, value] of splits.entries()) {
    if (value === 'nz') splits[index] = value.toUpperCase();
    else splits[index] = capitalize(value);
  }
  return splits.join(' ');
}
