import { describe, expect, test } from 'vitest';

import { Schema as S } from 'effect';

import { NumberFromSelfBigIntOrString } from './numeric';

describe('getEnvString', () => {
  const parseNumberFromSelfBigIntOrString = S.decodeUnknownSync(
    NumberFromSelfBigIntOrString,
  );

  test('should parse a number from number, bigint, decimal or hexadecimal string', () => {
    expect(parseNumberFromSelfBigIntOrString(123)).toBe(123);
    expect(parseNumberFromSelfBigIntOrString(123n)).toBe(123);
    expect(parseNumberFromSelfBigIntOrString('123')).toBe(123);
    expect(parseNumberFromSelfBigIntOrString('0xFF')).toBe(255);
    expect(parseNumberFromSelfBigIntOrString(Number.MAX_SAFE_INTEGER)).toBe(
      Number.MAX_SAFE_INTEGER,
    );
    expect(parseNumberFromSelfBigIntOrString(9007199254740991)).toBe(
      9007199254740991,
    );
    expect(parseNumberFromSelfBigIntOrString(9007199254740991n)).toBe(
      9007199254740991,
    );
    expect(parseNumberFromSelfBigIntOrString('9007199254740991')).toBe(
      9007199254740991,
    );
  });

  test('should throw when given an invalid number', () => {
    expect(() => parseNumberFromSelfBigIntOrString('asd')).toThrowError();
    expect(() => parseNumberFromSelfBigIntOrString('0x')).toThrowError();
    expect(() => parseNumberFromSelfBigIntOrString('0xg')).toThrowError();
    expect(() => parseNumberFromSelfBigIntOrString('true')).toThrowError();
    expect(() => parseNumberFromSelfBigIntOrString(false)).toThrowError();
  });

  test('should throw when the number is above the maximum safe integer', () => {
    expect(() =>
      parseNumberFromSelfBigIntOrString(Number.MAX_SAFE_INTEGER + 1),
    ).toThrowError();
    expect(() =>
      parseNumberFromSelfBigIntOrString(9007199254740992),
    ).toThrowError();
    expect(() =>
      parseNumberFromSelfBigIntOrString(9007199254740992n),
    ).toThrowError();
    expect(() =>
      parseNumberFromSelfBigIntOrString('9007199254740992'),
    ).toThrowError();
    expect(() => parseNumberFromSelfBigIntOrString(2n ** 53n)).toThrowError();
  });
});
