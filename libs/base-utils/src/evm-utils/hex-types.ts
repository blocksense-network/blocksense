/**
 * SPDX-FileCopyrightText: Copyright (c) 2023 Blockdaemon Inc.
 * SPDX-FileCopyrightText: Copyright (c) 2024 Schelling Point Labs Inc.
 *
 * SPDX-License-Identifier: MIT
 */

import * as S from '@effect/schema/Schema';

import { hexDataString } from '../buffer-and-hex-utils';

// Ethereum address

export const ethereumAddress = hexDataString.pipe(
  S.pattern(/^0x([0-9a-fA-F]{40})$/),
  S.brand('EthereumAddress'),
);
export type EthereumAddress = S.Schema.Type<typeof ethereumAddress>;
export const isEthereumAddress = S.is(ethereumAddress);
export const parseEthereumAddress = S.decodeUnknownSync(ethereumAddress);

// 32-byte hex string

export const hash32byte = hexDataString.pipe(
  S.pattern(/^0x([0-9a-fA-F]{64})$/),
  S.brand('32 byte hex string'),
);
export type Hash32byte = S.Schema.Type<typeof hash32byte>;

export const isHash32byte = S.is(hash32byte);
export const parseHash32byte = S.decodeUnknownSync(hash32byte);

// EVM transaction hash

export const txHash = hash32byte.pipe(S.brand('EVM transaction hash'));
export type TxHash = S.Schema.Type<typeof txHash>;

export const isTxHash = S.is(txHash);
export const parseTxHash = S.decodeUnknownSync(txHash);
