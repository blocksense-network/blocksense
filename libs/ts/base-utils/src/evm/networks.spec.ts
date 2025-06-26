/**
 * SPDX-FileCopyrightText: Copyright (c) 2023 Blockdaemon Inc.
 * SPDX-FileCopyrightText: Copyright (c) 2024 Schelling Point Labs Inc.
 *
 * SPDX-License-Identifier: MIT
 */

import { describe, expect, test } from 'vitest';
import {
  isNetworkName,
  isChainId,
  isNetwork,
  parseNetworkName,
  parseChainId,
  parseNetwork,
  getTxHashExplorerUrl,
  getAddressExplorerUrl,
  isTestnet,
} from './networks';
import { parseEthereumAddress, parseTxHash } from './hex-types';

describe('Network constants tests', () => {
  test(`'isNetworkName' should return true for valid network names`, () => {
    expect(isNetworkName('ethereum-mainnet')).toBe(true);
    expect(isNetworkName('ethereum-sepolia')).toBe(true);
    expect(isNetworkName('ethereum-holesky')).toBe(true);
  });

  test(`'isNetworkName' should return false for invalid network names`, () => {
    expect(isNetworkName('')).toBe(false);
    expect(isNetworkName('asd')).toBe(false);
    expect(isNetworkName('MAINNET')).toBe(false);
    expect(isNetworkName('goerli')).toBe(false);
    expect(isNetworkName('HOLESKY')).toBe(false);
  });

  test(`'parseNetworkName' should return the network name if it is valid`, () => {
    const validNetworkName = 'ethereum-mainnet';
    const result = parseNetworkName(validNetworkName);
    expect(result).toBe(validNetworkName);
  });

  test(`'parseNetworkName' should throw an error if the network name is not valid`, () => {
    const invalidNetworkName = 'asd';
    expect(() => parseNetworkName(invalidNetworkName)).toThrowError();
  });

  test(`'isChainId' should return true for valid chain IDs`, () => {
    expect(isChainId(1)).toBe(true);
    expect(isChainId(11155111)).toBe(true);
    expect(isChainId(17000)).toBe(true);
  });

  test(`'isChainId' should return false for invalid chain IDs`, () => {
    expect(isChainId(0)).toBe(false);
    expect(isChainId('asd')).toBe(false);
    expect(isChainId(false)).toBe(false);
    expect(isChainId({})).toBe(false);
  });

  test(`'parseChainId' should return the chain ID if it is valid`, () => {
    expect(parseChainId(1)).toBe(1);
    expect(parseChainId(1n)).toBe(1);
    expect(parseChainId('1')).toBe(1);
    expect(parseChainId('0xa')).toBe(10);
  });

  test(`'parseChainId' should throw an error if the chain ID is not valid`, () => {
    expect(() => parseChainId(0)).toThrowError();
    expect(() => parseChainId(true)).toThrowError();
    expect(() => parseChainId({})).toThrowError();
  });

  test(`'isNetwork' should return true for network names and chain ids`, () => {
    expect(isNetwork('ethereum-mainnet')).toBe(true);
    expect(isNetwork(1)).toBe(true);
  });

  test(`'isNetwork' should return false for invalid network names and chain ids`, () => {
    expect(isNetwork('asd')).toBe(false);
    expect(isNetwork(0)).toBe(false);
    expect(isNetwork(true)).toBe(false);
    expect(isNetwork({})).toBe(false);
  });

  test(`'parseNetwork' should return the network name if it is valid`, () => {
    expect(parseNetwork(1)).toBe(1);
    expect(parseNetwork('ethereum-mainnet')).toBe('ethereum-mainnet');
  });

  test(`'parseNetwork' should throw an error if the network name is not valid`, () => {
    expect(() => parseNetwork('asd')).toThrowError();
    expect(() => parseNetwork(0)).toThrowError();
    expect(() => parseNetwork(true)).toThrowError();
    expect(() => parseNetwork({})).toThrowError();
  });

  test('`isTestnet` should return true for testnet networks', () => {
    expect(isTestnet('ethereum-sepolia')).toBe(true);
    expect(isTestnet('ethereum-mainnet')).toBe(false);
  });

  test('should return correct url for ethereum-mainnet', () => {
    const txHash = parseTxHash(
      '0xe75fb554e433e03763a1560646ee22dcb74e5274b34c5ad644e7c0f619a7e1d0',
    );
    const address = parseEthereumAddress(
      '0x74c1e4b8cae59269ec1d85d3d4f324396048f4ac',
    );

    expect(getTxHashExplorerUrl('ethereum-mainnet', txHash)).toEqual(
      `https://etherscan.io/tx/${txHash}`,
    );
    expect(getAddressExplorerUrl('ethereum-mainnet', address)).toEqual(
      `https://etherscan.io/address/${address}`,
    );

    expect(getTxHashExplorerUrl('ethereum-sepolia', txHash)).toEqual(
      `https://sepolia.etherscan.io/tx/${txHash}`,
    );
    expect(getAddressExplorerUrl('ethereum-sepolia', address)).toEqual(
      `https://sepolia.etherscan.io/address/${address}`,
    );
  });
});
