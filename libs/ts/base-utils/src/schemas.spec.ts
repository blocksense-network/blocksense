// basic vitest scaffolding
import { describe, it, expect } from 'vitest';

import { Schema as S } from 'effect';
import { NumberFromSelfBigIntOrString } from './schemas';

describe('schemas', () => {
  describe('NumberFromSelfBigIntOrString', () => {
    const decode = S.decodeUnknownSync(NumberFromSelfBigIntOrString);
    const encode = S.encodeSync(NumberFromSelfBigIntOrString);

    it('should decode a number from number, bigint, decimal or hexadecimal string', () => {
      expect(decode(123)).toEqual(123);
      expect(decode(BigInt(123))).toEqual(123);
      expect(decode('123')).toEqual(123);
      expect(decode('0x1FF')).toBe(511);

      expect(decode(Number.MAX_SAFE_INTEGER)).toBe(2 ** 53 - 1);
      expect(decode(9007199254740991n)).toBe(2 ** 53 - 1);
      expect(decode('9007199254740991')).toBe(2 ** 53 - 1);
      expect(decode('0x1fffffffffffff')).toBe(2 ** 53 - 1);
    });

    it('should throw when the number is above the maximum safe integer', () => {
      expect(() => decode(Number.MAX_SAFE_INTEGER + 1)).toThrowError();
      expect(() => decode(9007199254740992n)).toThrowError();
      expect(() => decode('9007199254740992')).toThrowError();
      expect(() => decode(2n ** 53n)).toThrowError();
    });

    it('should throw when decoding an invalid number', () => {
      expect(() => decode('asd')).toThrowError();
      expect(() => decode('0x')).toThrowError();
      expect(() => decode('0xg')).toThrowError();
      expect(() => decode('true')).toThrowError();
      expect(() => decode(false)).toThrowError();
      expect(() => decode({})).toThrowError();
      expect(() => decode([])).toThrowError();
      expect(() => decode(new Date())).toThrowError();
    });

    it('should encode a number to bigint', () => {
      expect(encode(0)).toEqual(0n);
      expect(() => encode(BigInt(0) as any)).toThrowError();
      expect(() => encode('0' as any)).toThrowError();
      expect(encode(Number.MAX_SAFE_INTEGER)).toEqual(
        BigInt(Number.MAX_SAFE_INTEGER),
      );
      expect(encode(9007199254740991)).toEqual(9007199254740991n);

      // test out of range input
      expect(() => decode(Number.MAX_SAFE_INTEGER + 1)).toThrowError();
      expect(() =>
        decode(BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1)),
      ).toThrowError();
      expect(() => decode('9007199254740992')).toThrowError();
    });
  });
});
