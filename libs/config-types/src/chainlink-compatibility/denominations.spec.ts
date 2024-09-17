/**
 * SPDX-FileCopyrightText: Copyright (c) 2024 Schelling Point Labs Inc.
 *
 * SPDX-License-Identifier: MIT
 */

import { describe, expect, test } from 'vitest';

import {
  denominationTokenToAddress,
  isDenominationAddress,
  isDenominationToken,
  parseDenominationAddress,
  parseDenominationToken,
} from './denominations';

describe('Denominations', () => {
  test('should correctly identify denomination tokens', () => {
    expect(isDenominationToken('ETH')).toBe(true);
    expect(isDenominationToken('BTC')).toBe(true);
    expect(isDenominationToken('USD')).toBe(true);
    expect(isDenominationToken('InvalidToken')).toBe(false);
  });

  test('should correctly parse denomination tokens', () => {
    expect(parseDenominationToken('ETH')).toBe('ETH');
    expect(parseDenominationToken('BTC')).toBe('BTC');
    expect(parseDenominationToken('USD')).toBe('USD');
    expect(() => parseDenominationToken('InvalidToken')).toThrow();
  });

  test('should correctly identify denomination addresses', () => {
    expect(
      isDenominationAddress('0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'),
    ).toBe(true);
    expect(
      isDenominationAddress('0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB'),
    ).toBe(true);
    expect(
      isDenominationAddress('0x0000000000000000000000000000000000000348'),
    ).toBe(true);
    expect(isDenominationAddress('InvalidAddress')).toBe(false);
  });

  test('should correctly parse denomination addresses', () => {
    expect(
      parseDenominationAddress('0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'),
    ).toBe('0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE');
    expect(
      parseDenominationAddress('0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB'),
    ).toBe('0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB');
    expect(
      parseDenominationAddress('0x0000000000000000000000000000000000000348'),
    ).toBe('0x0000000000000000000000000000000000000348');
    expect(() => parseDenominationAddress('InvalidAddress')).toThrow();
  });

  test('should correctly map denomination tokens to addresses', () => {
    expect(denominationTokenToAddress['ETH']).toBe(
      '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    );
    expect(denominationTokenToAddress['BTC']).toBe(
      '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
    );
    expect(denominationTokenToAddress['USD']).toBe(
      '0x0000000000000000000000000000000000000348',
    );
  });
});
