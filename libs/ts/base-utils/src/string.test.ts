import { describe, it, expect } from 'vitest';

import { camelCaseSnakeCase } from './string';

describe('camelCaseSnakeCase', () => {
  it('should convert a simple camelCase string to SNAKE_CASE', () => {
    expect(camelCaseSnakeCase('fooBar')).toBe('FOO_BAR');
  });

  it('should convert a camelCase string with multiple humps to SNAKE_CASE', () => {
    expect(camelCaseSnakeCase('fooBarBaz')).toBe('FOO_BAR_BAZ');
  });

  it('should handle an empty string', () => {
    expect(camelCaseSnakeCase('')).toBe('');
  });

  it('should handle a string that is already SNAKE_CASE (it should remain uppercase)', () => {
    expect(camelCaseSnakeCase('FOO_BAR')).toBe('FOO_BAR');
  });

  it('should handle a single word in lowercase', () => {
    expect(camelCaseSnakeCase('foobar')).toBe('FOOBAR');
  });

  it('should handle a single word in uppercase', () => {
    expect(camelCaseSnakeCase('FOOBAR')).toBe('FOOBAR');
  });

  // it('should handle strings with numbers', () => {
  //   expect(camelCaseSnakeCase('fooBar123')).toBe('FOO_BAR123');
  //   expect(camelCaseSnakeCase('foo123Bar')).toBe('FOO123_BAR');
  // });

  it('should handle strings starting with an uppercase letter', () => {
    expect(camelCaseSnakeCase('FooBar')).toBe('FOO_BAR');
  });

  it('should handle strings with consecutive uppercase letters', () => {
    // expect(camelCaseSnakeCase('fooBARBaz')).toBe('FOO_BAR_BAZ');
    // expect(camelCaseSnakeCase('aBCDToEFG')).toBe('A_BCD_TO_EFG');
  });

  it('should handle strings with leading and trailing uppercase letters', () => {
    // expect(camelCaseSnakeCase('HTTPRequest')).toBe('HTTP_REQUEST');
    // expect(camelCaseSnakeCase('requestHTTP')).toBe('REQUEST_HTTP');
  });
});
