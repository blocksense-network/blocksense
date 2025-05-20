import { expect, test, describe } from 'vitest';
import {
  kebabToScreamingSnakeCase,
  kebabToCamelCase,
  padNumber,
} from './string';

describe('String Utils', () => {
  test('should convert kebab-case to SCREAMING_SNAKE_CASE', () => {
    const testCases: [input: string, expected: string][] = [
      // Valid transformations
      ['hello-world', 'HELLO_WORLD'],
      ['foo-bar-baz', 'FOO_BAR_BAZ'],
      ['convert-this-string', 'CONVERT_THIS_STRING'],
      ['a-b-c', 'A_B_C'],
      ['already-uppercase', 'ALREADY_UPPERCASE'],

      // Edge cases
      ['', ''],
      ['-', '_'],
      ['--', '__'],
      ['--a--b--', '__A__B__'],
      ['trailing-dash-', 'TRAILING_DASH_'],
      ['-leading-dash', '_LEADING_DASH'],
      ['multiple---hyphens', 'MULTIPLE___HYPHENS'],

      // Optional malformed / non-standard inputs
      ['not-kebab_Case', 'NOT_KEBAB_CASE'],
      ['with spaces', 'WITH SPACES'],
      ['MiXeD-CaSe-InPut', 'MIXED_CASE_INPUT'],
      ['123-abc-def', '123_ABC_DEF'],
      ['symbols-!@#-included', 'SYMBOLS_!@#_INCLUDED'],
    ];

    testCases.forEach(([input, expected]) =>
      expect(kebabToScreamingSnakeCase(input)).toBe(expected),
    );
  });

  test('should convert kebab-case to CamelCase', () => {
    const testCases: [input: string, expected: string][] = [
      // Valid transformations
      ['hello-world', 'helloWorld'],
      ['foo-bar-baz', 'fooBarBaz'],
      ['convert-this-string', 'convertThisString'],
      ['a-b-c', 'aBC'],
      ['alreadylowercase', 'alreadylowercase'],

      // Edge cases
      ['', ''],
      ['-', '-'],
      ['--', '--'],
      ['trailing-dash', 'trailingDash'],
      ['-leading-dash', 'LeadingDash'],
      ['123-abc-def', '123AbcDef'],
    ];

    testCases.forEach(([input, expected]) =>
      expect(kebabToCamelCase(input)).toBe(expected),
    );
  });

  test('should compare case insesitive strings', () => {
    const testCases: [a: string, b: string, expected: boolean][] = [
      // Basic case insensitivity
      ['hello', 'hello', true],
      ['HELLO', 'HELLO', true],
      ['hello', 'HELLO', true],
      ['WORLD', 'world', true],
      ['TeSt', 'tESt', true],

      // Exact match
      ['OpenAI', 'OpenAI', true],

      // Different lengths
      ['abc', 'abcd', false],
      ['test', 'tes', false],

      // Symbols and digits
      ['123abc', '123ABC', true],
      ['42abc', '123ABC', false],
      ['abc$', 'ABC$', true],
      ['abc$', 'ABC#', false],

      // Empty strings
      ['', '', true],
      ['a', '', false],
      ['', 'a', false],

      // Whitespace included
      [' hello ', 'HELLO', false],
      ['hello ', 'HELLO ', true],
    ];

    testCases.forEach(([a, b, expected]) =>
      expect(a.toLowerCase() === b.toLowerCase()).toBe(expected),
    );
  });
});
