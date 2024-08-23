/**
 * SPDX-FileCopyrightText: Copyright (c) 2023 Blockdaemon Inc.
 * SPDX-FileCopyrightText: Copyright (c) 2024 Schelling Point Labs Inc.
 *
 * SPDX-License-Identifier: MIT
 */

import { describe, expect, test } from 'vitest';

import {
  isHexString,
  isHexDataString,
  isHexQuantityString,
  parseHexDataString,
  parseHexQuantityString,
  parseHexString,
} from './types';

describe('`hex-types` tests', () => {
  test(`'isHexString' tests`, () => {
    expect(isHexString('0x')).toBe(true);
    expect(isHexString('')).toBe(true);
    expect(isHexString('1')).toBe(true);
    expect(isHexString('12')).toBe(true);
    expect(isHexString('ab')).toBe(true);
    expect(isHexString('AB')).toBe(true);
    expect(isHexString('ug')).toBe(false);
    expect(isHexString('0x12')).toBe(true);
    expect(isHexString('0xab')).toBe(true);
    expect(isHexString('0xAB')).toBe(true);
    expect(isHexString('0xug')).toBe(false);
  });

  test(`'isHexDataString' tests`, () => {
    expect(isHexDataString('0x')).toBe(true);
    expect(isHexDataString('')).toBe(true);
    expect(isHexDataString('1')).toBe(false);
    expect(isHexDataString('12')).toBe(true);
    expect(isHexDataString('ab')).toBe(true);
    expect(isHexDataString('AB')).toBe(true);
    expect(isHexDataString('ug')).toBe(false);
    expect(isHexDataString('0x12')).toBe(true);
    expect(isHexDataString('0xab')).toBe(true);
    expect(isHexDataString('0xAB')).toBe(true);
    expect(isHexDataString('0xug')).toBe(false);
  });

  test(`'isHexDataString' with min length`, () => {
    expect(isHexDataString('0x', 0)).toBe(true);
    expect(isHexDataString('0x', 2)).toBe(false);
    expect(isHexDataString('0a', 1)).toBe(true);
    expect(isHexDataString('0b', 1)).toBe(true);
    expect(isHexDataString('0b', 2)).toBe(false);
  });

  test(`'isHexQuantityString' tests`, () => {
    expect(isHexQuantityString('0x41')).toBe(true);
    expect(isHexQuantityString('0x400')).toBe(true);
    expect(isHexQuantityString('0x0')).toBe(true);
    expect(isHexQuantityString('')).toBe(false);
    expect(isHexQuantityString('0x')).toBe(false);
    expect(isHexQuantityString('0x0400')).toBe(false);
  });

  test(`'parseHexString' tests`, () => {
    expect(parseHexString('0x')).toBe('0x');
    expect(parseHexString('')).toBe('');
    expect(parseHexString('1')).toBe('1');
    expect(parseHexString('12')).toBe('12');
    expect(parseHexString('ab')).toBe('ab');
    expect(parseHexString('AB')).toBe('AB');
    expect(parseHexString('0x12')).toBe('0x12');
    expect(parseHexString('0xab')).toBe('0xab');
    expect(parseHexString('0xAB')).toBe('0xAB');
    expect(parseHexString('0x0400')).toBe('0x0400');
  });

  test(`'Ethereum Hex value encoding - quantities`, () => {
    /*
     * https://ethereum.org/en/developers/docs/apis/json-rpc/#quantities-encoding
     * Quantities (integer values)
     *
     * 0x41 (65 in decimal)
     * 0x400 (1024 in decimal)
     *
     * WRONG: 0x (should always have at least one digit - zero is "0x0")
     * WRONG: 0x0400 (no leading zeroes allowed)
     * WRONG: ff (must be prefixed 0x)
     */

    expect(parseHexQuantityString('0x41')).toBe('0x41');
    expect(parseHexQuantityString('0x400')).toBe('0x400');
    expect(parseHexQuantityString('0x0')).toBe('0x0');

    expect(() => {
      parseHexQuantityString('');
    }).toThrowError(
      `Expected quantity in hex string format (0x123...). Got: ''`,
    );

    expect(() => {
      parseHexQuantityString('0x');
    }).toThrowError(
      `Expected quantity in hex string format (0x123...). Got: '0x'`,
    );

    expect(() => {
      parseHexQuantityString('0x0400');
    }).toThrowError(
      `Expected quantity in hex string format (0x123...). Got: '0x0400'`,
    );

    expect(() => {
      parseHexQuantityString('ff');
    }).toThrowError(
      `Expected quantity in hex string format (0x123...). Got: 'ff'`,
    );
  });

  test(`'Ethereum Hex value encoding - unformatted data`, () => {
    /*
     * https://ethereum.org/en/developers/docs/apis/json-rpc/#unformatted-data-encoding
     * Unformatted Data
     *
     * 0x (empty bytes)
     * 0x41 (the letter A, in ASCII)
     * 0x0042 (the letter B, in ASCII, with leading zero)
     * 0x004200 (the letter B, in ASCII, with two leading zeroes)
     * 0x00420000 (the letter B, in ASCII, with three leading zeroes)
     * 0x000000000000 (6 zero bytes)
     */

    expect(parseHexDataString('0x')).toBe('0x');
    expect(parseHexDataString('0x41')).toBe('0x41');
    expect(parseHexDataString('0x0042')).toBe('0x0042');
    expect(parseHexDataString('0x004200')).toBe('0x004200');
    expect(parseHexDataString('0x00420000')).toBe('0x00420000');
    expect(parseHexDataString('0x41')).toBe('0x41');
    expect(parseHexDataString('0x000000000000')).toBe('0x000000000000');
  });
});
