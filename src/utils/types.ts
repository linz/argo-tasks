/**
 * Branded types can't be replaced with their underlying types. This means that we can't, for example, pass a `string`
 * when a function expects a `PathString`. This clarifies the semantics of containers (variables, parameters) while
 * allowing us to use the values of those containers as plain strings.
 *
 * See <https://egghead.io/blog/using-branded-types-in-typescript> for details.
 */

declare const __brand: unique symbol;
type Brand<B> = { [__brand]: B };

export type Branded<T, B> = T & Brand<B>;

export type PathString = Branded<string, 'Url'>;
export type UrlString = Branded<string, 'Path'>;
export type JSONString = Branded<string, 'JSONString'>;
