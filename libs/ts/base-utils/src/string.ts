/**
 * Converts a kebab-case string literal type to SNAKE_CASE.
 */
export type KebabToSnakeCase<S extends string> =
  S extends `${infer T}-${infer U}`
    ? `${Uppercase<T>}_${KebabToSnakeCase<U>}`
    : Uppercase<S>;

/**
 * Converts a kebab-case string to SNAKE_CASE.
 * @param str - The kebab-case string to convert.
 * @returns The SNAKE_CASE version of the input string.
 * @example
 * ```ts
 * kebabToSnakeCase('foo-bar'); // 'FOO_BAR'
 * ```
 * @see {@link KebabToSnakeCase}
 */
export function kebabToSnakeCase<Str extends string>(
  str: Str,
): KebabToSnakeCase<Str> {
  return str.replaceAll(/-/g, '_').toUpperCase() as KebabToSnakeCase<Str>;
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
 */
export function kebabToCamelCase<Str extends string>(
  str: Str,
): KebabToCamelCase<Str> {
  return str.replace(/-([a-z])/g, (_, char) =>
    char.toUpperCase(),
  ) as KebabToCamelCase<Str>;
}

/**
 * Converts a camelCase string to SNAKE_CASE.
 * @param str - The camelCase string to convert.
 * @returns The SNAKE_CASE version of the input string.
 * @example
 * ```ts
 * camelToSnakeCase('fooBar'); // 'FOO_BAR'
 * ```
 */
export function camelCaseSnakeCase(str: string) {
  return str.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
}

export function padNumber(num: number | bigint, size: number, padChar = ' ') {
  return num.toString().padStart(size, padChar);
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

export function envVarNameJoin(
  ...parts: (string | null | undefined)[]
): string {
  return parts
    .filter(x => x?.length ?? 0 > 0)
    .map(part => camelCaseSnakeCase(part!))
    .join('_');
}
