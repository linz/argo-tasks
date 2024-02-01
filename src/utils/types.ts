declare const __brand: unique symbol;
type Brand<B> = { [__brand]: B };

export type Branded<T, B> = T & Brand<B>;

export type PathString = Branded<string, 'Url'>;
export type UrlString = Branded<string, 'Path'>;
export type JSONString = Branded<string, 'JSONString'>;
