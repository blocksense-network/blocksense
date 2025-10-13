import { describe, expect, it } from 'vitest';

import { formatNumericalValue } from '../src/commands/feeds/read/adfs';

const padHex = (n: bigint, length: number) =>
  n.toString(16).padStart(length, '0');
const buildHex = (value: bigint, timestampMs: bigint) =>
  `0x${padHex(value, 48)}${padHex(timestampMs, 16)}` as `0x${string}`;

describe('formatNumericalValue', () => {
  it('parses minimal value and zero timestamp correctly', () => {
    const value = 1n;
    const tsMs = 0n;
    const hex = buildHex(value, tsMs);

    const res = formatNumericalValue(hex);

    expect(res.rawHex).toBe(hex);
    expect(res.value).toBe(value.toString());
    expect(res.timestamp.endsWith('(0)')).toBe(true);
  });

  it('parses arbitrary value and milliseconds -> seconds conversion', () => {
    const value = 42n;
    const tsMs = 1_695_000_000_123n;
    const expectedSeconds = (tsMs / 1000n).toString();
    const hex = buildHex(value, tsMs);

    const res = formatNumericalValue(hex);

    expect(res.value).toBe('42');
    expect(res.timestamp.endsWith(`(${expectedSeconds})`)).toBe(true);
  });

  it('handles max 24-byte value correctly', () => {
    const max24Byte = (1n << 192n) - 1n;
    const tsMs = 1_600_000_000_000n;
    const expectedSeconds = (tsMs / 1000n).toString();
    const hex = buildHex(max24Byte, tsMs);

    const res = formatNumericalValue(hex);

    expect(res.value).toBe(max24Byte.toString());
    expect(res.timestamp.endsWith(`(${expectedSeconds})`)).toBe(true);
  });

  it('throws on invalid length (not 32 bytes)', () => {
    const badHex = ('0x' + '0'.repeat(62)) as `0x${string}`;
    expect(() => formatNumericalValue(badHex)).toThrow(
      /Unexpected ADFS data length, expected 32 bytes \(64 hex characters\), got 62/,
    );
  });
});
