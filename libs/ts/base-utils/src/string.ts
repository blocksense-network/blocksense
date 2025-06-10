/**
 * Converts a kebab-case string literal type to SCREAMING_SNAKE_CASE.
 */
export type KebabToScreamingSnakeCase<S extends string> =
  S extends `${infer T}-${infer U}`
    ? `${Uppercase<T>}_${KebabToScreamingSnakeCase<U>}`
    : Uppercase<S>;

/**
 * Converts a kebab-case string to SCREAMING_SNAKE_CASE.
 * @param str - The kebab-case string to convert.
 * @returns The SCREAMING_SNAKE_CASE version of the input string.
 * @example
 * ```ts
 * kebabToScreamingSnakeCase('foo-bar'); // 'FOO_BAR'
 * ```
 * @see {@link KebabToScreamingSnakeCase}
 * @todo (milagenova): should we check input validity?
 */
export function kebabToScreamingSnakeCase<Str extends string>(
  str: Str,
): KebabToScreamingSnakeCase<Str> {
  return str
    .replaceAll(/-/g, '_')
    .toUpperCase() as KebabToScreamingSnakeCase<Str>;
}

/**
 * Converts a kebab-case string literal type to camelCase.
 */
export type KebabToCamelCase<S extends string> =
  S extends `${infer T}-${infer U}`
    ? `${T}${Capitalize<KebabToCamelCase<U>>}`
    : S;

/**
 * Converts a kebab-case string to camelCase.
 * @param str - The kebab-case string to convert.
 * @returns The camelCase version of the input string.
 * @example
 * ```ts
 * kebabToCamelCase('foo-bar-baz'); // 'fooBarBaz'
 * ```
 * @see {@link KebabToCamelCase}
 * @todo (milagenova): should we check input validity?
 */
export function kebabToCamelCase<Str extends string>(
  str: Str,
): KebabToCamelCase<Str> {
  return str.replace(/-([a-z])/g, (_, char) =>
    char.toUpperCase(),
  ) as KebabToCamelCase<Str>;
}

/**
 * Converts a camelCase string to SCREAMING_SNAKE_CASE.
 * @param str - The camelCase string to convert.
 * @returns The SCREAMING_SNAKE_CASE version of the input string.
 * @example
 * ```ts
 * camelCaseToScreamingSnakeCase('fooBar'); // 'FOO_BAR'
 * ```
 */
export function camelCaseToScreamingSnakeCase(str: string) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z])([a-z])/g, '$1_$2$3')
    .toUpperCase();
}

/**
 * Compares two strings for equality in a case-insensitive manner.
 *
 * @param a - The first string to compare.
 * @param b - The second string to compare.
 * @returns `true` if the strings are equal ignoring case, otherwise `false`.
 *
 * @todo Investigate why using `localeCompare` with `{ sensitivity: 'base' }`
 * causes the program to hang and consider re-enabling it for better locale support.
 */
export function equalsCaseInsensitive(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase();
}

export function padNumber(num: number | bigint, size: number, padChar = ' ') {
  return num.toString().padStart(size, padChar);
}
