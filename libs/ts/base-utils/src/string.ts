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
