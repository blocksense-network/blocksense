import { describe, expect, test } from 'vitest';

import { assertIsObject, assertNotNull } from './assert';

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

  test('`assertIsObject` should return the `value` if it is an `object` and not `null`', () => {
    const value1 = { test: 'test' };
    expect(assertIsObject(value1)).toBe(value1);

    const value2 = { test: 'test' };
    expect(assertIsObject(value2)).not.toBe({ test: 'test' });
  });

  test('`assertIsObject` should throw an error if the `value` is `null` or any primitive type', () => {
    expect(() => assertIsObject(null)).toThrowError(
      "Assertion failed: value (=== 'null') is not an object",
    );

    expect(() => assertIsObject(undefined)).toThrowError(
      "Assertion failed: value (=== 'undefined') is not an object",
    );

    expect(() => assertIsObject(0)).toThrowError(
      "Assertion failed: value (=== '0') is not an object",
    );

    expect(() => assertIsObject('asd')).toThrowError(
      "Assertion failed: value (=== 'asd') is not an object",
    );
  });
});
