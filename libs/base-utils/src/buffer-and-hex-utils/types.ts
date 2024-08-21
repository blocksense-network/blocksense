/**
 * SPDX-FileCopyrightText: Copyright (c) 2023 Blockdaemon Inc.
 * SPDX-FileCopyrightText: Copyright (c) 2024 Schelling Point Labs Inc.
 *
 * SPDX-License-Identifier: MIT
 */

import * as S from '@effect/schema/Schema';

import { ExpectedHexStringError } from './errors';
import { byteLength } from './functions';

/**
 * Ethereum hex value encoding
 * See: https://ethereum.org/en/developers/docs/apis/json-rpc/#hex-encoding
 * * Quantities (integer values)
 * * Unformatted Data
 */

/**
 * A schema representing a hexadecimal string.
 *
 * This constant is a branded schema that represents a hexadecimal string. It uses the `S.String.pipe` function
 * to create a string type that matches a pattern. The pattern matches a string that optionally starts with '0x'
 * and is followed by any number of hexadecimal digits (0-9, a-f, A-F).
 */
export const hexString = S.String.pipe(
  S.pattern(/^(0x)?([0-9a-fA-F])*$/),
  S.brand('Hex String'),
);

/**
 * A schema representing an unformatted hexadecimal data string.
 * ref: https://ethereum.org/en/developers/docs/apis/json-rpc/#unformatted-data-encoding
 */
export const hexDataString = hexString.pipe(
  S.pattern(/^(0x)?([0-9a-fA-F]{2})*$/),
  S.brand('Unformatted Data'),
);

/**
 * A schema representing an unformatted hexadecimal quantity string.
 * ref: https://ethereum.org/en/developers/docs/apis/json-rpc/#quantities-encoding
 */
export const hexQuantityString = hexString.pipe(
  S.pattern(/^0x(([1-9a-fA-F][0-9a-fA-F]*)|0)$/),
  S.brand('Quantity'),
);

export type HexString = S.Schema.Type<typeof hexString>;
export type HexDataString = S.Schema.Type<typeof hexDataString>;
export type HexQuantityString = S.Schema.Type<typeof hexQuantityString>;

export const isHexString = S.is(hexString);
export const _isHexDataString = S.is(hexDataString);
export const isHexQuantityString = S.is(hexQuantityString);

export function isHexDataString(
  input: unknown,
  minByteLength = 0,
): input is HexDataString {
  return _isHexDataString(input) && byteLength(input) >= minByteLength;
}

export function parseHexString(input: unknown): HexString {
  if (isHexString(input)) return input;
  else throw new ExpectedHexStringError(String(input));
}

export function parseHexDataString(
  input: unknown,
  minByteLength = 0,
): HexDataString {
  if (isHexDataString(input, minByteLength)) return input;
  else throw new ExpectedHexStringError(String(input), minByteLength);
}

export function parseHexQuantityString(input: unknown): HexQuantityString {
  if (isHexQuantityString(input)) return input;
  else throw new ExpectedHexStringError(String(input), 'quantity');
}

// Ethereum address

export const ethereumAddress = hexDataString.pipe(
  S.pattern(/^0x([0-9a-fA-F]{40})$/),
  S.brand('EthereumAddress'),
);
export type EthereumAddress = S.Schema.Type<typeof ethereumAddress>;

export const isEthereumAddress = S.is(ethereumAddress);

export function parseEthereumAddress(input: unknown): EthereumAddress {
  if (isEthereumAddress(input)) return input;
  else throw new ExpectedHexStringError(String(input), 40);
}

export type Without0x<S extends string> = S extends `0x${infer R}` ? R : S;
