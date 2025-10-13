import { describe, expect, it } from 'vitest';

import {
  camelCaseToScreamingSnakeCase,
  envVarNameJoin,
  kebabToCamelCase,
  kebabToHumanReadable,
  kebabToScreamingSnakeCase,
} from './string';

describe('camelCaseSnakeCase', () => {
  it('should convert a simple camelCase string to SNAKE_CASE', () => {
    expect(camelCaseToScreamingSnakeCase('fooBar')).toBe('FOO_BAR');
  });

  it('should convert a camelCase string with multiple humps to SNAKE_CASE', () => {
    expect(camelCaseToScreamingSnakeCase('fooBarBaz')).toBe('FOO_BAR_BAZ');
  });

  it('should handle an empty string', () => {
    expect(camelCaseToScreamingSnakeCase('')).toBe('');
  });

  it('should handle a string that is already SNAKE_CASE (it should remain uppercase)', () => {
    expect(camelCaseToScreamingSnakeCase('FOO_BAR')).toBe('FOO_BAR');
  });

  it('should handle a single word in lowercase', () => {
    expect(camelCaseToScreamingSnakeCase('foobar')).toBe('FOOBAR');
  });

  it('should handle a single word in uppercase', () => {
    expect(camelCaseToScreamingSnakeCase('FOOBAR')).toBe('FOOBAR');
  });

  it('should handle strings with numbers', () => {
    expect(camelCaseToScreamingSnakeCase('fooBar123')).toBe('FOO_BAR123');
    expect(camelCaseToScreamingSnakeCase('foo123Bar')).toBe('FOO123_BAR');
  });

  it('should handle strings starting with an uppercase letter', () => {
    expect(camelCaseToScreamingSnakeCase('FooBar')).toBe('FOO_BAR');
  });

  it('should handle strings with consecutive uppercase letters', () => {
    expect(camelCaseToScreamingSnakeCase('fooBARBaz')).toBe('FOO_BAR_BAZ');
    expect(camelCaseToScreamingSnakeCase('aBCDToEFG')).toBe('A_BCD_TO_EFG');
  });

  it('should handle strings with leading and trailing uppercase letters', () => {
    expect(camelCaseToScreamingSnakeCase('HTTPRequest')).toBe('HTTP_REQUEST');
    expect(camelCaseToScreamingSnakeCase('HttpRequest')).toBe('HTTP_REQUEST');
    expect(camelCaseToScreamingSnakeCase('requestHTTP')).toBe('REQUEST_HTTP');
    expect(camelCaseToScreamingSnakeCase('requestHttp')).toBe('REQUEST_HTTP');
  });
});

describe('envVarNameJoin', () => {
  it('should join multiple camelCase strings and convert them to SCREAMING_SNAKE_CASE', () => {
    expect(envVarNameJoin('fooBar', 'bazQux', 'helloWorld')).toBe(
      'FOO_BAR_BAZ_QUX_HELLO_WORLD',
    );
  });

  it('should filter out null and undefined parts', () => {
    expect(
      envVarNameJoin('partOne', null, 'partTwo', undefined, 'partThree'),
    ).toBe('PART_ONE_PART_TWO_PART_THREE');
  });

  it('should filter out empty string parts', () => {
    expect(
      envVarNameJoin('firstPart', '', 'secondPart', '  ', 'thirdPart'),
    ).toBe('FIRST_PART_SECOND_PART_THIRD_PART');
  });

  it('should handle an empty array of parts', () => {
    expect(envVarNameJoin()).toBe('');
  });

  it('should handle an array with only null, undefined, or empty string parts', () => {
    expect(envVarNameJoin(null, undefined, '', '   ')).toBe('');
  });

  it('should handle a single valid part', () => {
    expect(envVarNameJoin('singlePart')).toBe('SINGLE_PART');
  });

  it('should handle parts that are already in SCREAMING_SNAKE_CASE', () => {
    expect(envVarNameJoin('ALREADY_SNAKE', 'anotherPart')).toBe(
      'ALREADY_SNAKE_ANOTHER_PART',
    );
  });

  it('should handle mixed case parts correctly', () => {
    expect(envVarNameJoin('mixedCase', 'ALLCAPS', 'lowerCase')).toBe(
      'MIXED_CASE_ALLCAPS_LOWER_CASE',
    );
  });

  it('should handle parts with numbers', () => {
    expect(envVarNameJoin('part1', 'part2WithNumber')).toBe(
      'PART1_PART2_WITH_NUMBER',
    );
  });
});

describe('kebabToHumanReadable', () => {
  it('converts simple kebab-case to human readable', () => {
    expect(kebabToHumanReadable('this-is-cool')).toBe('This Is Cool');
  });

  it('handles single segment', () => {
    expect(kebabToHumanReadable('single')).toBe('Single');
  });

  it('handles empty string', () => {
    expect(kebabToHumanReadable('')).toBe('');
  });

  it('skips consecutive dashes (empty segments)', () => {
    expect(kebabToHumanReadable('this--is---cool')).toBe('This Is Cool');
  });

  it('handles leading and trailing dashes', () => {
    expect(kebabToHumanReadable('-leading-trailing-')).toBe('Leading Trailing');
  });

  it('preserves inner casing except first letter capitalization', () => {
    expect(kebabToHumanReadable('mixED-case-WORD')).toBe('MixED Case WORD');
  });

  it('handles numbers in segments', () => {
    expect(kebabToHumanReadable('version-2-release-10')).toBe(
      'Version 2 Release 10',
    );
  });
});

describe('String Utils', () => {
  it('should convert kebab-case to SCREAMING_SNAKE_CASE', () => {
    const testCases: Array<[input: string, expected: string]> = [
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

  it('should convert kebab-case to CamelCase', () => {
    const testCases: Array<[input: string, expected: string]> = [
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

  it('should compare case insesitive strings', () => {
    const testCases: Array<[a: string, b: string, expected: boolean]> = [
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
