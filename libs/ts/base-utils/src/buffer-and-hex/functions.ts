/**
 * SPDX-FileCopyrightText: Copyright (c) 2023 Blockdaemon Inc.
 * SPDX-FileCopyrightText: Copyright (c) 2024 Schelling Point Labs Inc.
 *
 * SPDX-License-Identifier: MIT
 */

import { Buffer } from 'buffer';

import { ReplaceType } from '../type-level';
import {
  byteLength,
  HexDataString,
  HexQuantityString,
  HexString,
  parseHexDataString,
  Without0x,
} from './types';

/**
 * Replaces all instances of Uint8Array with hex string in the given object.
 * If an array or nested object is encountered, the function recursively
 * applies the replacement to its elements.
 *
 * @param obj - The object to process.
 * @returns The modified object with Uint8Array replaced by string.
 */
export function replaceUint8Array<T>(
  obj: T,
): ReplaceType<T, Uint8Array, HexDataString> {
  type Res = ReplaceType<T, Uint8Array, HexDataString>;
  if (obj instanceof Uint8Array) {
    return arrayToHex(obj) as Res;
  }
  if (typeof obj !== 'object' || obj == null) {
    return obj as Res;
  }
  if (obj instanceof Array) {
    const result: unknown[] = [];
    for (const value of obj) {
      result.push(replaceUint8Array(value));
    }
    return result as unknown as Res;
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = replaceUint8Array(value);
  }
  return result as Res;
}

/**
 * Replaces all instances of hex string with Uint8Array in the given object.
 * If an array or nested object is encountered, the function recursively
 * applies the replacement to its elements.
 *
 * @param obj - The object to process. Must have hex strings as values.
 * @returns The modified object with string replaced by Uint8Array.
 */
export function replaceHexString<T>(
  obj: T,
): ReplaceType<T, HexDataString, Uint8Array> {
  type Res = ReplaceType<T, HexDataString, Uint8Array>;
  if (typeof obj === 'string') {
    return hexToArray(obj as string as HexDataString) as Res;
  }
  if (typeof obj !== 'object' || obj == null) {
    return obj as Res;
  }
  if (obj instanceof Array) {
    const result: unknown[] = [];
    for (const value of obj) {
      result.push(replaceHexString(value));
    }
    return result as unknown as Res;
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = replaceHexString(value);
  }
  return result as Res;
}

/**
 * Converts a Uint8Array to a hexadecimal string representation.
 *
 * @param arr - The Uint8Array to convert.
 * @returns The hexadecimal string representation of the Uint8Array.
 */
export function arrayToHex(arr: Uint8Array): HexDataString {
  return ('0x' + Buffer.from(arr).toString('hex')) as HexDataString;
}

/**
 * Converts a hexadecimal string to a Buffer.
 *
 * @param hex - The hexadecimal string to convert.
 * @returns The Buffer representation of the hexadecimal string.
 */
export function hexToBuffer(hex: HexDataString): Buffer {
  return Buffer.from(skip0x(hex), 'hex');
}

/**
 * Converts a hexadecimal string to a Uint8Array.
 *
 * @param hex - The hexadecimal string to convert.
 * @returns The Uint8Array representation of the hexadecimal string.
 */
export function hexToArray(hex: HexDataString): Uint8Array {
  const buffer = hexToBuffer(hex);
  return Uint8Array.from(buffer);
}

/**
 * Checks the length of a field value and converts it to a Uint8Array.
 *
 * @param hex - The hexadecimal string to convert.
 * @param expectedByteLength - The expected length of the field.
 * @returns The converted Uint8Array value.
 * @throws Error if the field value has an invalid length.
 */
export function checkedHexToArray(
  hex: HexDataString,
  expectedByteLength: number,
): Uint8Array {
  if (byteLength(hex) !== expectedByteLength) {
    throw new Error(
      `Invalid length. Received: ${hex} with length ${
        skip0x(hex).length
      }. Expected length: ${expectedByteLength}`,
    );
  }
  return hexToArray(hex);
}

/**
 * Removes the '0x' prefix from a string.
 *
 * @param input - The string to remove the '0x' prefix from.
 * @returns The string with the '0x' prefix removed.
 */
export function skip0x<S extends string>(input: S): Without0x<S> {
  return input.replace(/^0x/, '') as Without0x<S>;
}

/**
 * Adds the '0x' prefix to a string if it doesn't have it already.
 * @param str - The string to add the prefix to.
 * @returns The string with the '0x' prefix.
 */
export function addHexPrefix(str: HexString): HexString {
  return (str.startsWith('0x') ? str : '0x' + str) as HexString;
}

/**
 * Splits a hexadecimal data string into equal parts.
 *
 * @param {HexDataString} str - The hexadecimal data string to split.
 * @param {number} partLength - The length of each part in bytes.
 *
 * @returns {HexDataString[]} An array of hexadecimal data strings.
 *
 * @throws {Error} If the length of the hex string is not a multiple of 2 or the part length.
 */
export function splitHexStringEqually(
  str: HexDataString,
  partLength: number,
): HexDataString[] {
  const clearStr = skip0x(str);
  if (str.length % 2 !== 0) {
    throw new Error(
      `Invalid length. Received: string with length ${clearStr.length}. Expected length to be a multiple of 2`,
    );
  }
  partLength *= 2;
  if (clearStr.length % partLength !== 0) {
    throw new Error(
      `Invalid length. Received: string with byte length ${byteLength}. Expected length to be a multiple of ${partLength}`,
    );
  }
  const result: HexDataString[] = [];
  let start = 0;
  for (let index = partLength; index < clearStr.length; index += partLength) {
    result.push(('0x' + clearStr.substring(start, index)) as HexDataString);
    start = index;
  }
  if (clearStr.length) {
    result.push(('0x' + clearStr.substring(start)) as HexDataString);
  }
  return result;
}

/**
 * Splits a hexadecimal data string at the specified byte offsets.
 *
 * @param {HexDataString} str - The hexadecimal data string to split.
 * @param {...number[]} byteOffsets - The byte offsets at which to split the hex string.
 *
 * @returns {HexDataString[]} An array of hexadecimal data strings.
 *
 * @throws {Error} If any offset is greater than the length of the hex string.
 */
export function splitHexString(
  str: HexDataString,
  ...byteOffsets: number[]
): HexDataString[] {
  let clearStr = skip0x(str);
  const result: HexDataString[] = [];
  for (const offset of byteOffsets) {
    if (offset > clearStr.length / 2) {
      throw new Error(
        `Split offset out of range. Offset: ${offset} | Length: ${
          clearStr.length / 2
        }`,
      );
    }
    const res = ('0x' + clearStr.slice(0, offset * 2)) as HexDataString;
    clearStr = clearStr.slice(offset * 2) as HexDataString;
    result.push(res);
  }
  result.push(('0x' + clearStr) as HexDataString);
  return result;
}

/**
 * Converts little-endian hexadecimal bytes to a BigInt.
 *
 * @param hex - The little-endian hexadecimal bytes.
 * @returns The BigInt representation of the little-endian bytes.
 */
export function littleEndianBytesToBigInt(hex: HexDataString): bigint {
  return BigInt('0x' + hexToBuffer(hex).reverse().toString('hex'));
}

export function toHex(num: number | bigint): HexQuantityString {
  return ('0x' + num.toString(16)) as HexQuantityString;
}

/**
 * Converts a number or bigint to a hexadecimal quantity string.
 * @param {number | bigint} num - The number or bigint to convert to a hexadecimal string.
 * @returns {HexQuantityString} The hexadecimal representation of the input number or bigint.
 */
export function toHexData(
  num: number | bigint,
  maxByteLength = 0,
): HexDataString {
  return padHex(toHex(num), maxByteLength);
}

/**
 * Pads a hexadecimal string to a maximum byte length.
 *
 * @param {HexString} hexStr - The hexadecimal string to pad.
 * @param {number} [maxByteLength=0] - The maximum byte length that the hexadecimal string should have. Default is 0.
 * @returns {HexDataString} The hexadecimal string, padded to the maximum byte length.
 */
export function padHex(hexStr: HexString, maxByteLength = 0): HexDataString {
  let cleanHexStr = skip0x(hexStr);
  maxByteLength = Math.max(maxByteLength, Math.ceil(cleanHexStr.length / 2));
  cleanHexStr = cleanHexStr.padStart(maxByteLength * 2, '0') as HexString;
  return ('0x' + cleanHexStr) as HexDataString;
}

/**
 * Appends multiple hexadecimal data strings together.
 *
 * @param {...HexDataString[]} hexStrings - The hexadecimal data strings to append.
 * @returns {HexDataString} The appended hexadecimal data string.
 */
export function appendHex(...hexStrings: HexDataString[]): HexDataString {
  return ('0x' + hexStrings.map(skip0x).join('')) as HexDataString;
}

/**
 * Checks if a string represents a valid integer.
 * @param data - The string to be checked.
 * @returns An object containing the validation result and the parsed integer value.
 * - `valid` indicates if the string is a valid integer.
 * - `value` is the parsed integer value.
 */
export function isValidInteger(data: string): {
  valid: boolean;
  value: number;
} {
  const value = Number(data);
  return { valid: Number.isInteger(value), value };
}

/**
 * Returns a preview of a hex string by showing only the first and last few bytes.
 *
 * If the hex string is shorter than 4 bytes, it is returned as is. Otherwise, the function
 * returns a string that starts with the first `bytesToShow` bytes of the hex string, followed
 * by '...', followed by the last `bytesToShow` bytes of the hex string.
 *
 * @param hex - The string to preview.
 * @param bytesToShow - The number of bytes to show at the start and end of the
 *  hex string. Default is 2.
 *
 * @returns {string} A preview of the hex string.
 *
 * @example
 * previewHexString('0xabcd000000001234') == '0xabcd...1234';
 */
export function previewHexString(
  hexString: string,
  bytesToShow: number = 2,
): string {
  const hex = parseHexDataString(hexString);
  // if hex is shorter than 4 bytes, it should not be shortened
  if (bytesToShow <= 0)
    throw new Error('`bytesToShow` must be a non-negative number');
  if (byteLength(hex) <= 4) return hex;
  if (byteLength(hex) == bytesToShow * 2) return hex;
  const [start, _] = splitHexString(hex, bytesToShow);
  const end = hex.substring(hex.length - bytesToShow * 2);

  return `${start}...${end}`;
}
