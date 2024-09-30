import { throwError } from './errors';

import { ok } from 'assert';

let assert: (value: unknown, errorMessage?: string) => asserts value;

if (
  typeof process !== 'undefined' &&
  process.env['NODE_ENV'] !== 'production'
) {
  assert = ok;
} else {
  assert = function assert(
    value: unknown,
    errorMessage?: string,
  ): asserts value {
    if (!value) throwError(errorMessage ?? 'Assertion failed');
  };
}

export { assert };

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
  assert(
    value != null && (typeof value !== 'string' || value.length),
    errorMessage ?? 'Assertion failed: value is null',
  );
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
  assert(
    typeof value === 'object' && value != null,
    errorMessage ?? `Assertion failed: value (=== '${value}') is not an object`,
  );
  return value;
}
