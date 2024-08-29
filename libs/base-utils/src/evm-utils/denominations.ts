/**
 * SPDX-FileCopyrightText: Copyright (c) 2024 Schelling Point Labs Inc.
 *
 * SPDX-License-Identifier: MIT
 */

import * as S from '@effect/schema/Schema';

const denominationTokens = [
  'ETH',
  'BTC',
  'USD',
  'GBP',
  'EUR',
  'JPY',
  'KRW',
  'CNY',
  'AUD',
  'CAD',
  'CHF',
  'ARS',
  'PHP',
  'NZD',
  'SGD',
  'NGN',
  'ZAR',
  'RUB',
  'INR',
  'BRL',
] as const;

const denominationAddresses = [
  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
  '0x0000000000000000000000000000000000000348',
  '0x000000000000000000000000000000000000033a',
  '0x00000000000000000000000000000000000003d2',
  '0x0000000000000000000000000000000000000188',
  '0x000000000000000000000000000000000000019a',
  '0x000000000000000000000000000000000000009c',
  '0x0000000000000000000000000000000000000024',
  '0x000000000000000000000000000000000000007c',
  '0x00000000000000000000000000000000000002F4',
  '0x0000000000000000000000000000000000000020',
  '0x0000000000000000000000000000000000000260',
  '0x000000000000000000000000000000000000022A',
  '0x00000000000000000000000000000000000002be',
  '0x0000000000000000000000000000000000000236',
  '0x00000000000000000000000000000000000002c6',
  '0x0000000000000000000000000000000000000283',
  '0x0000000000000000000000000000000000000164',
  '0x00000000000000000000000000000000000003Da',
] as const;

export const denominationToken = S.Literal(...denominationTokens);
export const isDenominationToken = S.is(denominationToken);
export const _parseDenominationToken = S.encodeSync(denominationToken);
export type DenominationToken = S.Schema.Type<typeof denominationToken>;

export function parseDenominationToken(token: unknown): DenominationToken {
  if (!isDenominationToken(token)) {
    throw new Error(`Received invalid denomination token: '${token}'`);
  }
  return _parseDenominationToken(token);
}

export const denominationAddress = S.Literal(...denominationAddresses);
export const isDenominationAddress = S.is(denominationAddress);
export const _parseDenominationAddress = S.encodeSync(denominationAddress);
export type DenominationAddress = S.Schema.Type<typeof denominationAddress>;

export function parseDenominationAddress(
  address: unknown,
): DenominationAddress {
  if (!isDenominationAddress(address)) {
    throw new Error(`Received invalid denomination address: '${address}'`);
  }
  return _parseDenominationAddress(address);
}

export const denominationTokenToAddress = {
  ETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  BTC: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
  USD: '0x0000000000000000000000000000000000000348',
  GBP: '0x000000000000000000000000000000000000033a',
  EUR: '0x00000000000000000000000000000000000003d2',
  JPY: '0x0000000000000000000000000000000000000188',
  KRW: '0x000000000000000000000000000000000000019a',
  CNY: '0x000000000000000000000000000000000000009c',
  AUD: '0x0000000000000000000000000000000000000024',
  CAD: '0x000000000000000000000000000000000000007c',
  CHF: '0x00000000000000000000000000000000000002F4',
  ARS: '0x0000000000000000000000000000000000000020',
  PHP: '0x0000000000000000000000000000000000000260',
  NZD: '0x000000000000000000000000000000000000022A',
  SGD: '0x00000000000000000000000000000000000002be',
  NGN: '0x0000000000000000000000000000000000000236',
  ZAR: '0x00000000000000000000000000000000000002c6',
  RUB: '0x0000000000000000000000000000000000000283',
  INR: '0x0000000000000000000000000000000000000164',
  BRL: '0x00000000000000000000000000000000000003Da',
} satisfies {
  [Token in DenominationToken]: DenominationAddress;
};
