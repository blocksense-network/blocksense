/**
 * SPDX-FileCopyrightText: Copyright (c) 2024 Schelling Point Labs Inc.
 *
 * SPDX-License-Identifier: MIT
 */

import { EthereumAddress } from '@blocksense/base-utils/evm-utils';

const currencySymbol = [
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

export type CurrencySymbol = (typeof currencySymbol)[number];

export const currencySymbolToDenominationAddress = {
  ETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as EthereumAddress,
  BTC: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB' as EthereumAddress,
  USD: '0x0000000000000000000000000000000000000348' as EthereumAddress,
  GBP: '0x000000000000000000000000000000000000033a' as EthereumAddress,
  EUR: '0x00000000000000000000000000000000000003d2' as EthereumAddress,
  JPY: '0x0000000000000000000000000000000000000188' as EthereumAddress,
  KRW: '0x000000000000000000000000000000000000019a' as EthereumAddress,
  CNY: '0x000000000000000000000000000000000000009c' as EthereumAddress,
  AUD: '0x0000000000000000000000000000000000000024' as EthereumAddress,
  CAD: '0x000000000000000000000000000000000000007c' as EthereumAddress,
  CHF: '0x00000000000000000000000000000000000002F4' as EthereumAddress,
  ARS: '0x0000000000000000000000000000000000000020' as EthereumAddress,
  PHP: '0x0000000000000000000000000000000000000260' as EthereumAddress,
  NZD: '0x000000000000000000000000000000000000022A' as EthereumAddress,
  SGD: '0x00000000000000000000000000000000000002be' as EthereumAddress,
  NGN: '0x0000000000000000000000000000000000000236' as EthereumAddress,
  ZAR: '0x00000000000000000000000000000000000002c6' as EthereumAddress,
  RUB: '0x0000000000000000000000000000000000000283' as EthereumAddress,
  INR: '0x0000000000000000000000000000000000000164' as EthereumAddress,
  BRL: '0x00000000000000000000000000000000000003Da' as EthereumAddress,
} satisfies {
  [Token in CurrencySymbol]: EthereumAddress;
};

export function isKnownDenominationSymbol(
  symbol: string,
): symbol is CurrencySymbol {
  return symbol in currencySymbolToDenominationAddress;
}
