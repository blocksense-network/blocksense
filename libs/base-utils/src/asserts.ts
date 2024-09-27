import { throwError } from './errors';

/**
 * Asserts that a value is not null or undefined.
 *
 * @param value - The value to check.
 * @param errorMessage - Optional error message to throw if the assertion fails.
 * @returns The value itself if it is not null or undefined.
 * @throws Error if the value is null, undefined, or an empty string.
 */
export function assertNotNull<T>(
  value: T | null | undefined,
  errorMessage?: string,
): T {
  if (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && !value.length)
  ) {
    throwError(errorMessage ?? 'Assertion failed: value is null');
  }
  return value;
}

/**
 * Asserts that `value` is an object and not null.
 *
 * @param value - The value to check.
 * @param errorMessage - Optional error message to throw if the assertion fails.
 * @returns The value itself if it is an object and not null.
 * @throws Error if the value is null or not an object.
 */
export function assertIsObject<T>(value: T, errorMessage?: string): T & object {
  return typeof value === 'object' && value != null
    ? value
    : throwError(
        errorMessage ??
          `Assertion failed: value (=== '${value}') is not an object`,
      );
}
