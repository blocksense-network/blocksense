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
    throw new Error(errorMessage ?? 'Assertion failed: value is null');
  }
  return value;
}
