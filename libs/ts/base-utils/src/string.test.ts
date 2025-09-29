import { describe, it, expect } from 'vitest';

import {
  camelCaseToScreamingSnakeCase,
  envVarNameJoin,
  kebabToHumanReadable,
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
