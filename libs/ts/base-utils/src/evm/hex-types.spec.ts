/**
 * SPDX-FileCopyrightText: Copyright (c) 2023 Blockdaemon Inc.
 * SPDX-FileCopyrightText: Copyright (c) 2024 Schelling Point Labs Inc.
 *
 * SPDX-License-Identifier: MIT
 */

import { describe, expect, test } from 'vitest';

import {
  isEthereumAddress,
  isHash32byte,
  isTxHash,
  parseEthereumAddress,
  parseHash32byte,
  parseTxHash,
} from './hex-types';

describe('Hex types', () => {
  test(`'isEthereumAddress' should return true for valid Ethereum addresses`, () => {
    expect(
      isEthereumAddress('0x0001020304050607080910111213141516171819'),
    ).toBe(true);
    expect(
      isEthereumAddress('0xaabbccddeeff00112233445566778899aabbccdd'),
    ).toBe(true);
    expect(
      isEthereumAddress('0xAABBCCDDEEFF00112233445566778899AABBCCDD'),
    ).toBe(true);

    expect(
      parseEthereumAddress('0x0001020304050607080910111213141516171819'),
    ).toBe('0x0001020304050607080910111213141516171819');
    expect(
      parseEthereumAddress('0xaabbccddeeff00112233445566778899aabbccdd'),
    ).toBe('0xaabbccddeeff00112233445566778899aabbccdd');
    expect(
      parseEthereumAddress('0xAABBCCDDEEFF00112233445566778899AABBCCDD'),
    ).toBe('0xAABBCCDDEEFF00112233445566778899AABBCCDD');
  });

  test(`'isEthereumAddress' should return false for invalid Ethereum addresses`, () => {
    expect(isEthereumAddress('')).toBe(false);
    expect(isEthereumAddress('0x')).toBe(false);
    expect(isEthereumAddress('0x0')).toBe(false);
    expect(isEthereumAddress('0x00')).toBe(false);
    // 0x prefix is required
    expect(isEthereumAddress('0001020304050607080910111213141516171819')).toBe(
      false,
    );
    expect(isEthereumAddress('0xAABBCCDDEEFF00112233445566778899AABBCC')).toBe(
      false,
    );
    expect(isEthereumAddress('0xAABBCCDDEEFF00112233445566778899AABBCCD')).toBe(
      false,
    );
    expect(
      isEthereumAddress('0xAABBCCDDEEFF00112233445566778899AABBCCDDE'),
    ).toBe(false);
    expect(
      isEthereumAddress('0xAABBCCDDEEFF00112233445566778899AABBCCDDEE'),
    ).toBe(false);
  });

  test(`'isEthereumAddress' - 0X prefix is not allowed`, () => {
    expect(
      isEthereumAddress('0Xaabbccddeeff00112233445566778899aabbccdd'),
    ).toBe(false);
    expect(
      isEthereumAddress('0XAABBCCDDEEFF00112233445566778899AABBCCDD'),
    ).toBe(false);
  });

  test(`'isHash32byte|isTxHash' should return true for valid 32-byte hashes`, () => {
    expect(
      isHash32byte(
        '0x0001020304050607080910111213141516171819202122232425262728293031',
      ),
    ).toBe(true);
    expect(
      isTxHash(
        '0x0001020304050607080910111213141516171819202122232425262728293031',
      ),
    ).toBe(true);

    expect(
      isHash32byte(
        '0x000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
      ),
    ).toBe(true);
    expect(
      isTxHash(
        '0x000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
      ),
    ).toBe(true);
    expect(
      isHash32byte(
        '0x000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F',
      ),
    ).toBe(true);
    expect(
      isTxHash(
        '0x000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F',
      ),
    ).toBe(true);

    expect(
      parseHash32byte(
        '0x0001020304050607080910111213141516171819202122232425262728293031',
      ),
    ).toBe(
      '0x0001020304050607080910111213141516171819202122232425262728293031',
    );
    expect(
      parseTxHash(
        '0x0001020304050607080910111213141516171819202122232425262728293031',
      ),
    ).toBe(
      '0x0001020304050607080910111213141516171819202122232425262728293031',
    );

    expect(
      parseHash32byte(
        '0x000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
      ),
    ).toBe(
      '0x000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
    );
    expect(
      parseTxHash(
        '0x000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
      ),
    ).toBe(
      '0x000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
    );

    expect(
      parseHash32byte(
        '0x000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F',
      ),
    ).toBe(
      '0x000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F',
    );
    expect(
      parseTxHash(
        '0x000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F',
      ),
    ).toBe(
      '0x000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F',
    );
  });

  test(`'isHash32byte|isTxHash' should return false for invalid 32-byte hashes`, () => {
    expect(isHash32byte('')).toBe(false);
    expect(isTxHash('')).toBe(false);
    expect(isHash32byte('0x')).toBe(false);
    expect(isTxHash('0x')).toBe(false);
    expect(isHash32byte('0x0')).toBe(false);
    expect(isTxHash('0x00')).toBe(false);
    expect(
      isHash32byte(
        '0x000102030405060708091011121314151617181920212223242526272829303',
      ),
    ).toBe(false);
    expect(
      isTxHash(
        '0x000102030405060708091011121314151617181920212223242526272829303',
      ),
    ).toBe(false);
    expect(
      isHash32byte(
        '0x00010203040506070809101112131415161718192021222324252627282930331',
      ),
    ).toBe(false);
    expect(
      isTxHash(
        '0x00010203040506070809101112131415161718192021222324252627282930331',
      ),
    ).toBe(false);
    expect(
      isHash32byte(
        '0x000102030405060708091011121314151617181920212223242526272829303312',
      ),
    ).toBe(false);
    expect(
      isTxHash(
        '0x000102030405060708091011121314151617181920212223242526272829303312',
      ),
    ).toBe(false);
    expect(
      isHash32byte(
        '0x000102030405060708091011121314151617181920212223242526272829303313',
      ),
    ).toBe(false);
    expect(
      isTxHash(
        '0x000102030405060708091011121314151617181920212223242526272829303313',
      ),
    ).toBe(false);
    expect(
      isEthereumAddress(
        '0X0001020304050607080910111213141516171819202122232425262728293031',
      ),
    ).toBe(false);
    expect(
      isTxHash(
        '0X0001020304050607080910111213141516171819202122232425262728293031',
      ),
    ).toBe(false);
  });
});
