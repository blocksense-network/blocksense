/**
 * SPDX-FileCopyrightText: Copyright (c) 2023 Blockdaemon Inc.
 * SPDX-FileCopyrightText: Copyright (c) 2024 Schelling Point Labs Inc.
 *
 * SPDX-License-Identifier: MIT
 */

import { Schema as S } from 'effect';

import { hexDataString } from '../buffer-and-hex';

// Ethereum address

export const ethereumAddress = S.TemplateLiteral(
  '0x',
  hexDataString.pipe(
    S.pattern(/^0x([0-9a-fA-F]{40})$/),
    S.brand('EthereumAddress'),
    S.annotations({ identifier: 'EthereumAddress' }),
  ),
);
export type EthereumAddress = typeof ethereumAddress.Type;
export const isEthereumAddress = S.is(ethereumAddress);
export const parseEthereumAddress = S.decodeUnknownSync(ethereumAddress);

// 32-byte hex string

export const hash32byte = hexDataString.pipe(
  S.pattern(/^0x([0-9a-fA-F]{64})$/),
  S.brand('32 byte hex string'),
);
export type Hash32byte = typeof hash32byte.Type;

export const isHash32byte = S.is(hash32byte);
export const parseHash32byte = S.decodeUnknownSync(hash32byte);

// EVM transaction hash

export const txHash = hash32byte.pipe(
  S.brand('EVM TxHash'),
  S.annotations({ identifier: 'EVM TxHash' }),
);
export type TxHash = typeof txHash.Type;

export const isTxHash = S.is(txHash);
export const parseTxHash = S.decodeUnknownSync(txHash);

export const zeroAddress = parseEthereumAddress(
  '0x0000000000000000000000000000000000000000',
);
export const isZeroAddress = (address: unknown): address is EthereumAddress =>
  address === zeroAddress;
