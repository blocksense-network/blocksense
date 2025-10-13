import { describe, expect, it } from 'vitest';

import {
  bigIntToBytesBE,
  bytesToBigIntBE,
  powerOf10BigInt,
  truncate,
} from './utilities';

// bytesToBigIntBE now lives in utilities.ts

function minimalByteLen(x: bigint): number {
  if (x === 0n) return 1;
  const bitLen = x.toString(2).length;
  return Math.ceil(bitLen / 8);
}

describe('truncate', () => {
  it('returns the original string when length <= maxLen', () => {
    expect(truncate('hello', 5)).toBe('hello');
    expect(truncate('hi', 5)).toBe('hi');
    expect(truncate('', 3)).toBe('');
  });

  it('cuts to exactly maxLen when string is longer', () => {
    expect(truncate('abcdefgh', 3)).toBe('abc');
    expect(truncate('1234567890', 0)).toBe('');
  });

  it('handles corner cases for large and negative maxLen', () => {
    expect(truncate('hello', 100)).toBe('hello');
    expect(truncate('hello', -42)).toBe('');
  });
});

describe('powerOf10BigInt', () => {
  it('throws on negative input', () => {
    expect(() => powerOf10BigInt(-1)).toThrow(Error);
    expect(() => powerOf10BigInt(-1)).toThrow(
      'powerOf10BigInt: n must be >= 0',
    );
    expect(() => powerOf10BigInt(-1)).toThrow(/>=\s*0/);
  });

  it('throws on floating point input', () => {
    expect(() => powerOf10BigInt(0.5)).toThrow(
      'powerOf10BigInt: n must be an integer',
    );
    expect(() => powerOf10BigInt(1.5)).toThrow(/integer/);
    expect(() => powerOf10BigInt(Math.PI)).toThrow(Error);
  });

  it('handles small n correctly', () => {
    expect(powerOf10BigInt(0)).toBe(1n);
    expect(powerOf10BigInt(1)).toBe(10n);
    expect(powerOf10BigInt(2)).toBe(100n);
    expect(powerOf10BigInt(5)).toBe(100000n);
  });

  it('produces 1 followed by n zeros for a range of n', () => {
    for (let n = 0; n <= 100; n++) {
      const s = powerOf10BigInt(n).toString();
      expect(s[0]).toBe('1');
      expect(s.slice(1)).toBe('0'.repeat(n));
      // monotonicity for sanity
      if (n > 0)
        expect(powerOf10BigInt(n)).toBeGreaterThan(powerOf10BigInt(n - 1));
    }
  });
});

describe('bigIntToBytesBE', () => {
  it('throws on negative input', () => {
    expect(() => bigIntToBytesBE(-1n)).toThrow(/negative/);
  });

  it('encodes zero as a single zero byte', () => {
    const buf = bigIntToBytesBE(0n);
    expect(buf.equals(Buffer.from([0]))).toBe(true);
  });

  it('encodes small values without leading zeros', () => {
    expect(bigIntToBytesBE(1n)).toEqual(Buffer.from([1]));
    expect(bigIntToBytesBE(255n)).toEqual(Buffer.from([255]));
    expect(bigIntToBytesBE(256n)).toEqual(Buffer.from([1, 0]));
    expect(bigIntToBytesBE(65535n)).toEqual(Buffer.from([255, 255]));
    expect(bigIntToBytesBE(65536n)).toEqual(Buffer.from([1, 0, 0]));
  });

  it('is big-endian (MSB first)', () => {
    // 0x0102 -> [0x01, 0x02]
    const x = 0x0102n;
    expect(bigIntToBytesBE(x)).toEqual(Buffer.from([1, 2]));
  });

  it('uses the minimal number of bytes for positive inputs', () => {
    const values = [
      1n,
      2n,
      255n,
      256n,
      65535n,
      65536n,
      (1n << 63n) - 1n,
      1n << 63n,
    ];
    for (const v of values) {
      const buf = bigIntToBytesBE(v);
      expect(buf.length).toBe(minimalByteLen(v));
      if (v > 0n) expect(buf[0]).not.toBe(0); // no leading zero bytes
    }
  });

  it('round-trips across a variety of values', () => {
    const values: bigint[] = [
      0n,
      1n,
      42n,
      255n,
      256n,
      123456789n,
      2n ** 32n - 1n,
      2n ** 32n,
      2n ** 64n - 1n,
      2n ** 64n,
      (1n << 128n) - 1n,
      1n << 128n,
      BigInt('1' + '0'.repeat(50)), // 10^50
    ];

    for (const v of values) {
      const buf = bigIntToBytesBE(v);
      const back = bytesToBigIntBE(buf);
      expect(back).toBe(v);
    }
  });
});

describe('bytesToBigIntBE', () => {
  it('decodes empty buffer as 0n', () => {
    expect(bytesToBigIntBE(Buffer.from([]))).toBe(0n);
  });

  it('decodes single zero byte as 0n', () => {
    expect(bytesToBigIntBE(Buffer.from([0]))).toBe(0n);
  });

  it('decodes small values', () => {
    expect(bytesToBigIntBE(Buffer.from([1]))).toBe(1n);
    expect(bytesToBigIntBE(Buffer.from([255]))).toBe(255n);
    expect(bytesToBigIntBE(Buffer.from([1, 0]))).toBe(256n);
    expect(bytesToBigIntBE(Buffer.from([255, 255]))).toBe(65535n);
    expect(bytesToBigIntBE(Buffer.from([1, 0, 0]))).toBe(65536n);
  });

  it('is big-endian (MSB first)', () => {
    expect(bytesToBigIntBE(Buffer.from([1, 2]))).toBe(0x0102n);
  });

  it('ignores leading zeros', () => {
    expect(bytesToBigIntBE(Buffer.from([0, 0, 1]))).toBe(1n);
  });
});
