import { describe, expect, test } from 'vitest';

import { assertNotNull } from './asserts';

describe('`base-utils/asserts` tests', () => {
  test(`'assertNotNull' should return the value if it is not null or undefined`, () => {
    const value = 'test';
    const result = assertNotNull(value);
    expect(result).toBe(value);
  });

  test(`'assertNotNull' should throw an error if the value is null`, () => {
    const value = null;
    expect(() => assertNotNull(value)).toThrowError(
      'Assertion failed: value is null',
    );
  });

  test(`'assertNotNull' should throw an error if the value is undefined`, () => {
    const value = undefined;
    expect(() => assertNotNull(value)).toThrowError(
      'Assertion failed: value is null',
    );
  });

  test(`'assertNotNull' should throw an error if the value is an empty string`, () => {
    const value = '';
    expect(() => assertNotNull(value)).toThrowError(
      'Assertion failed: value is null',
    );
  });

  test(`'assertNotNull' should throw a custom error message if provided`, () => {
    const value = null;
    const errorMessage = 'Value cannot be null';
    expect(() => assertNotNull(value, errorMessage)).toThrowError(errorMessage);
  });
});
