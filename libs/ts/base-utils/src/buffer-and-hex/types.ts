/**
 * SPDX-FileCopyrightText: Copyright (c) 2023 Blockdaemon Inc.
 * SPDX-FileCopyrightText: Copyright (c) 2024 Schelling Point Labs Inc.
 *
 * SPDX-License-Identifier: MIT
 */

import { Schema as S } from 'effect';

import { ExpectedHexStringError } from './errors';

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

export type Without0x<S extends string> = S extends `0x${infer R}` ? R : S;

/**
 * Returns the byte length of a hexadecimal data string.
 *
 * This function calculates the byte length of the input hex string. If the hex string starts with '0x',
 * these two characters are not counted in the byte length. If the length of the hex string is not a multiple of 2,
 * an error is thrown.
 *
 * @param {HexDataString} hex - The hexadecimal data string to calculate the byte length of.
 * @returns {number} The byte length of the hex string.
 * @throws {Error} If the length of the hex string is not a multiple of 2.
 */
export function byteLength(hex: HexDataString): number {
  if (hex.length % 2 !== 0) {
    throw new Error(
      `Invalid length. Received: string '${hex}' with length ${hex.length}. Expected length to be a multiple of 2`,
    );
  }
  const stringLength = hex.length - (hex.startsWith('0x') ? 2 : 0);
  return stringLength / 2;
}
