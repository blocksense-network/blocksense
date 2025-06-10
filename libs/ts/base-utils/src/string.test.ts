import { describe, it, expect } from 'vitest';

import { camelCaseToScreamingSnakeCase } from './string';

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
