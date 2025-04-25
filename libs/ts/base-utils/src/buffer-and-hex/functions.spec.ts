/**
 * SPDX-FileCopyrightText: Copyright (c) 2023 Blockdaemon Inc.
 * SPDX-FileCopyrightText: Copyright (c) 2024 Schelling Point Labs Inc.
 *
 * SPDX-License-Identifier: MIT
 */

import { describe, expect, test } from 'vitest';
import { Buffer } from 'buffer';

import {
  HexDataString,
  parseHexDataString,
  parseHexString,
  byteLength,
} from './types';

import {
  addHexPrefix,
  arrayToHex,
  checkedHexToArray,
  hexToArray,
  hexToBuffer,
  isValidInteger,
  littleEndianBytesToBigInt,
  replaceHexString,
  replaceUint8Array,
  skip0x,
  splitHexString,
  splitHexStringEqually,
  toHexData,
  padHex,
  appendHex,
  previewHexString,
} from './functions';

describe('`buffer-and-hex-utils` tests', () => {
  test(`'replaceUint8Array' should replace Uint8Array with string in the object`, () => {
    const obj = {
      data: new Uint8Array([1, 2, 3]),
      nested: {
        array: [new Uint8Array([4, 5]), new Uint8Array([6, 7])],
      },
    };

    const result = replaceUint8Array(obj);
    expect(result).toEqual({
      data: '0x010203',
      nested: {
        array: ['0x0405', '0x0607'],
      },
    });
  });

  test(`'replaceHexString' should replace string with Uint8Array in the object`, () => {
    const obj = {
      data: '0x010203',
      nested: {
        array: ['0x0405', '0x0607'],
      },
    };

    const result = replaceHexString(obj);

    expect(result).toEqual({
      data: new Uint8Array([1, 2, 3]),
      nested: {
        array: [new Uint8Array([4, 5]), new Uint8Array([6, 7])],
      },
    });
  });

  test(`'arrayToHex' should convert Uint8Array to hexadecimal string`, () => {
    const arr = new Uint8Array([1, 2, 3]);
    const result = arrayToHex(arr);
    expect(result).toBe('0x010203');
  });

  test(`'hexToBuffer' should convert hexadecimal string to Buffer`, () => {
    const hex = parseHexDataString('010203');
    const result = hexToBuffer(hex);
    expect(result).toEqual(Buffer.from([1, 2, 3]));
  });

  test(`'hexToArray' should convert hexadecimal string to Uint8Array`, () => {
    const hex = parseHexDataString('010203');
    const result = hexToArray(hex);
    expect(result).toEqual(Uint8Array.from([1, 2, 3]));
  });

  test(`'checkedHexToArray' returns Uint8Array when hex length matches expected length`, () => {
    const hex = parseHexDataString('0x12345678');
    const expectedLength = 4;
    const result = checkedHexToArray(hex, expectedLength);

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result).toHaveLength(expectedLength);
  });

  test(`'checkedHexToArray' throws an error when hex length does not match expected length`, () => {
    const hex = parseHexDataString('0x1234');
    const expectedLength = 8;

    expect(() => {
      checkedHexToArray(hex, expectedLength);
    }).toThrowError(
      `Invalid length. Received: ${hex} with length ${
        hex.length - 2
      }. Expected length: ${expectedLength}`,
    );
  });

  test(`'skipOx' removes the "0x" prefix from a string`, () => {
    const input = '0x123abc';
    const expected = '123abc';
    const result = skip0x(input);
    expect(result).toEqual(expected);
  });

  test(`'skipOx' does not modify the string if the "0x" prefix is not present`, () => {
    const input = '123abc';
    const expected = '123abc';
    const result = skip0x(input);
    expect(result).toEqual(expected);
  });

  test(`'addHexPrefix' should add the "0x" prefix to a string without it`, () => {
    const input = parseHexDataString('123abc');
    const expected = '0x123abc';
    const result = addHexPrefix(input);
    expect(result).toBe(expected);
  });

  test(`'addHexPrefix' should not modify a string with the "0x" prefix`, () => {
    const input = parseHexDataString('0x456def');
    const expected = '0x456def';
    const result = addHexPrefix(input);
    expect(result).toBe(expected);
  });

  test(`'littleEndianBytesToBigInt' should convert little-endian bytes to BigInt`, () => {
    const hex = parseHexDataString('0102');
    const result = littleEndianBytesToBigInt(hex);
    expect(result).toBe(BigInt(513));
  });

  test(`'isValidInteger' returns correct data for strings representing numbers `, () => {
    expect(isValidInteger('123')).toEqual({ valid: true, value: 123 });
    expect(isValidInteger('0')).toEqual({ valid: true, value: 0 });
    expect(isValidInteger('-42')).toEqual({ valid: true, value: -42 });
    expect(isValidInteger('')).toEqual({ valid: true, value: 0 });
    expect(isValidInteger(' ')).toEqual({ valid: true, value: 0 });
  });

  test(`'isValidInteger' returns false for strings not representing numbers `, () => {
    expect(isValidInteger('123.45')).toEqual({
      valid: false,
      value: 123.45,
    });
    expect(isValidInteger('abc')).toEqual({ valid: false, value: NaN });
  });

  test(`'splitHexString' correctly splits with single`, () => {
    const hexStr = '0x0011223344556677' as HexDataString;

    expect(splitHexString(hexStr)).toEqual([hexStr]);
    expect(splitHexString(hexStr, 0)).toEqual(['0x', hexStr]);
    expect(splitHexString(hexStr, 0)).toEqual(['0x', '0x0011223344556677']);
    expect(splitHexString(hexStr, 1)).toEqual(['0x00', '0x11223344556677']);
    expect(splitHexString(hexStr, 2)).toEqual(['0x0011', '0x223344556677']);
    expect(splitHexString(hexStr, 3)).toEqual(['0x001122', '0x3344556677']);
    expect(splitHexString(hexStr, 4)).toEqual(['0x00112233', '0x44556677']);
    expect(splitHexString(hexStr, 5)).toEqual(['0x0011223344', '0x556677']);
    expect(splitHexString(hexStr, 6)).toEqual(['0x001122334455', '0x6677']);
    expect(splitHexString(hexStr, 7)).toEqual(['0x00112233445566', '0x77']);
    expect(splitHexString(hexStr, 8)).toEqual(['0x0011223344556677', '0x']);
  });

  test(`'splitHexString' correctly splits with single`, () => {
    const hexStr = '0x0011223344556677' as HexDataString;

    expect(() => {
      splitHexString(hexStr, 9);
    }).toThrowError(`Split offset out of range. Offset: 9 | Length: 8`);
    expect(() => {
      splitHexString(hexStr, 4242);
    }).toThrowError(`Split offset out of range. Offset: 4242 | Length: 8`);
  });

  test(`'splitHexString' correctly splits with multiple lengths`, () => {
    const enum DepositDataLengths {
      PUBKEY_LEN = 48,
      WITHDRAWAL_CREDENTIALS_LEN = 32,
      SIGNATURE_LEN = 96,
      DEPOSIT_DATA_ROOT_LEN = 32,
      DEPOSIT_ARGS_LEN = PUBKEY_LEN +
        WITHDRAWAL_CREDENTIALS_LEN +
        SIGNATURE_LEN +
        DEPOSIT_DATA_ROOT_LEN,
    }

    const txData =
      '0x592c0b7d0000000000000000000000000000000000000000000000000000000064de9585000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000d0a5cd1bd700e92fe0d602dcff490826c45bc3e1dbf710fd69b36b836be91aa43c5ed6360f653a7847f8c2a9a8a1f42170010000000000000000000000bc3f349cb562ef987f5a6def2acd2e149ea41bf0b719b95e18fff5d1503c76e3553335414841ec31f211d177e639a8d6f60aa35b845a312723373315a4704540df9e653c14a6bf887b18583479f352ff082c62fd6d87a077fdfba21081eda1d74d6c83ac78704c7a12fc080ff683534dffa2b598869f1051aadb094392c40527b31b2dad15c9f754a9dc757e95f8a90541c567db00000000000000000000000000000000' as HexDataString;
    const [methodId, encodedParams] = splitHexString(txData, 4);
    const [validUntil, argsArr] = splitHexString(encodedParams, 32);
    const [arrOffset, arrLength, argsWithPadding] = splitHexString(
      argsArr,
      32,
      32,
    );
    const numberOfDeposits = Math.floor(
      byteLength(argsWithPadding) / DepositDataLengths.DEPOSIT_ARGS_LEN,
    );
    const [args, padding] = splitHexString(
      argsWithPadding,
      DepositDataLengths.DEPOSIT_ARGS_LEN * numberOfDeposits,
    );

    const chunks = splitHexStringEqually(
      args,
      DepositDataLengths.DEPOSIT_ARGS_LEN,
    );
    const dataItems = chunks.map(chunk =>
      splitHexString(
        chunk,
        DepositDataLengths.PUBKEY_LEN,
        DepositDataLengths.WITHDRAWAL_CREDENTIALS_LEN,
        DepositDataLengths.SIGNATURE_LEN,
        DepositDataLengths.DEPOSIT_DATA_ROOT_LEN,
      ),
    );

    expect(methodId).toEqual('0x592c0b7d');
    expect(validUntil).toEqual(
      '0x0000000000000000000000000000000000000000000000000000000064de9585',
    );
    expect(arrOffset).toEqual(
      '0x0000000000000000000000000000000000000000000000000000000000000040',
    );
    expect(arrLength).toEqual(
      '0x00000000000000000000000000000000000000000000000000000000000000d0',
    );
    expect(dataItems).toEqual([
      [
        '0xa5cd1bd700e92fe0d602dcff490826c45bc3e1dbf710fd69b36b836be91aa43c5ed6360f653a7847f8c2a9a8a1f42170',
        '0x010000000000000000000000bc3f349cb562ef987f5a6def2acd2e149ea41bf0',
        '0xb719b95e18fff5d1503c76e3553335414841ec31f211d177e639a8d6f60aa35b845a312723373315a4704540df9e653c14a6bf887b18583479f352ff082c62fd6d87a077fdfba21081eda1d74d6c83ac78704c7a12fc080ff683534dffa2b598',
        '0x869f1051aadb094392c40527b31b2dad15c9f754a9dc757e95f8a90541c567db',
        '0x',
      ],
    ]);
    expect(padding).toEqual('0x00000000000000000000000000000000');
  });

  test(`'padHex' should pad a hex string to the desired length`, () => {
    expect(padHex(parseHexString(''))).toBe('0x');
    expect(padHex(parseHexString('0'), 1)).toBe('0x00');
    expect(padHex(parseHexString('0'), 2)).toBe('0x0000');
    expect(padHex(parseHexString('123'))).toBe('0x0123');
    expect(padHex(parseHexString('123'), 1)).toBe('0x0123');
    expect(padHex(parseHexString('123'), 2)).toBe('0x0123');
    expect(padHex(parseHexString('123'), 3)).toBe('0x000123');
  });

  test(`'appendHex' should append hex strings`, () => {
    expect(appendHex(parseHexDataString(''), parseHexDataString(''))).toBe(
      '0x',
    );
    expect(appendHex(parseHexDataString('12'), parseHexDataString('34'))).toBe(
      '0x1234',
    );
    expect(
      appendHex(parseHexDataString('0x12'), parseHexDataString('34')),
    ).toBe('0x1234');
    expect(
      appendHex(parseHexDataString('12'), parseHexDataString('0x34')),
    ).toBe('0x1234');
    expect(
      appendHex(parseHexDataString('0x12'), parseHexDataString('0x34')),
    ).toBe('0x1234');
  });

  test(`'toHexData' should convert a number to a HexDataString with padding (if needed)`, () => {
    expect(toHexData(0)).toBe('0x00');
    expect(toHexData(0, 1)).toBe('0x00');
    expect(toHexData(0, 2)).toBe('0x0000');
    expect(toHexData(0, 3)).toBe('0x000000');
    expect(toHexData(0, 4)).toBe('0x00000000');
    expect(toHexData(0, 5)).toBe('0x0000000000');
    expect(toHexData(0, 6)).toBe('0x000000000000');
    expect(toHexData(0, 7)).toBe('0x00000000000000');

    expect(toHexData(1)).toBe('0x01');
    expect(toHexData(1, 1)).toBe('0x01');
    expect(toHexData(1, 2)).toBe('0x0001');
    expect(toHexData(1, 3)).toBe('0x000001');
    expect(toHexData(1, 4)).toBe('0x00000001');
    expect(toHexData(1, 5)).toBe('0x0000000001');
    expect(toHexData(1, 6)).toBe('0x000000000001');
    expect(toHexData(1, 7)).toBe('0x00000000000001');

    expect(toHexData(383)).toBe('0x017f');
    expect(toHexData(383, 1)).toBe('0x017f');
    expect(toHexData(383, 2)).toBe('0x017f');
    expect(toHexData(383, 3)).toBe('0x00017f');
    expect(toHexData(383, 4)).toBe('0x0000017f');
    expect(toHexData(383, 5)).toBe('0x000000017f');
    expect(toHexData(383, 6)).toBe('0x00000000017f');

    expect(toHexData(0x123)).toBe('0x0123');
    expect(toHexData(0x123, 1)).toBe('0x0123');
    expect(toHexData(0x123, 2)).toBe('0x0123');
    expect(toHexData(0x123, 3)).toBe('0x000123');
    expect(toHexData(0x123, 4)).toBe('0x00000123');
    expect(toHexData(0x123, 5)).toBe('0x0000000123');
    expect(toHexData(0x123, 6)).toBe('0x000000000123');
    expect(toHexData(0x123, 7)).toBe('0x00000000000123');

    expect(toHexData(0x123, 32)).toBe(
      '0x0000000000000000000000000000000000000000000000000000000000000123',
    );
  });

  test(`'previewHexString' should truncate hex strings`, () => {
    expect(previewHexString('0x')).toBe('0x');
    expect(previewHexString('0x00')).toBe('0x00');
    expect(previewHexString('0x0000')).toBe('0x0000');
    expect(previewHexString('0xabcd1234')).toBe('0xabcd1234');
    expect(previewHexString('0xabcd001234')).toBe('0xabcd...1234');
    expect(previewHexString('0xabcd000000001234')).toBe('0xabcd...1234');
    expect(previewHexString('0xabcd000000001234', 1)).toBe('0xab...34');
    expect(previewHexString('0xabcd000000001234', 3)).toBe('0xabcd00...001234');
    expect(previewHexString('0xabcd000000001234', 4)).toBe(
      '0xabcd000000001234',
    );

    expect(() => previewHexString('0x', 0)).toThrowError(
      '`bytesToShow` must be a non-negative number',
    );
    expect(() => previewHexString('0x', -1)).toThrowError(
      '`bytesToShow` must be a non-negative number',
    );

    expect(() => previewHexString('0xzz')).toThrowError(
      `Expected argument in hex string format (0xab12...) with byte length >= 0. Got: '0xzz'`,
    );
  });
});
