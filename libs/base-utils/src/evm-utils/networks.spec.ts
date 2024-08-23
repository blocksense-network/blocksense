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
  chainIdToNetworkName,
  explorerUrls,
  networkNameToChainId,
} from './networks';
import { parseTxHash } from './hex-types';

describe('Network constants tests', () => {
  test(`'isNetworkName' should return true for valid network names`, () => {
    expect(isNetworkName('mainnet')).toBe(true);
    expect(isNetworkName('sepolia')).toBe(true);
    expect(isNetworkName('holesky')).toBe(true);
  });

  test(`'isNetworkName' should return false for invalid network names`, () => {
    expect(isNetworkName('')).toBe(false);
    expect(isNetworkName('asd')).toBe(false);
    expect(isNetworkName('MAINNET')).toBe(false);
    expect(isNetworkName('goerli')).toBe(false);
    expect(isNetworkName('HOLESKY')).toBe(false);
  });

  test(`'parseNetworkName' should return the network name if it is valid`, () => {
    const validNetworkName = 'mainnet';
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
  });

  test(`'parseChainId' should throw an error if the chain ID is not valid`, () => {
    expect(() => parseChainId(0)).toThrowError();
    expect(() => parseChainId(true)).toThrowError();
    expect(() => parseChainId({})).toThrowError();
  });

  test(`'isNetwork' should return true for network names and chain ids`, () => {
    expect(isNetwork('mainnet')).toBe(true);
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
    expect(parseNetwork('mainnet')).toBe('mainnet');
  });

  test(`'parseNetwork' should throw an error if the network name is not valid`, () => {
    expect(() => parseNetwork('asd')).toThrowError();
    expect(() => parseNetwork(0)).toThrowError();
    expect(() => parseNetwork(true)).toThrowError();
    expect(() => parseNetwork({})).toThrowError();
  });

  test(`'networkNameToChainId' should return the correct chain ID for each network`, () => {
    expect(networkNameToChainId.mainnet).toBe(1);
    expect(networkNameToChainId.sepolia).toBe(11155111);
    expect(networkNameToChainId.holesky).toBe(17000);
  });

  test(`'chainIdToNetworkName' should return the network name for a valid chain ID`, () => {
    expect(chainIdToNetworkName[1]).toBe('mainnet');
    expect(chainIdToNetworkName[11155111]).toBe('sepolia');
    expect(chainIdToNetworkName[17000]).toBe('holesky');
  });

  test(`'explorerUrls' should return the correct explorer URL for supported network`, () => {
    const txHash = parseTxHash(
      '0xe75fb554e433e03763a1560646ee22dcb74e5274b34c5ad644e7c0f619a7e1d0',
    );
    expect(explorerUrls.mainnet(txHash)).toBe(
      `https://etherscan.io/tx/${txHash}`,
    );
    expect(explorerUrls.sepolia(txHash)).toBe(
      `https://sepolia.etherscan.io/tx/${txHash}`,
    );
    expect(explorerUrls.holesky(txHash)).toBe(
      `https://holesky.etherscan.io/tx/${txHash}`,
    );
    expect(explorerUrls.amoy(txHash)).toBe(
      `https://amoy.polygonscan.com/tx/${txHash}`,
    );
    expect(explorerUrls.manta(txHash)).toBe(
      `https://pacific-explorer.sepolia-testnet.manta.network/tx/${txHash}`,
    );
    expect(explorerUrls.fuji(txHash)).toBe(
      `https://testnet.snowtrace.io/tx/${txHash}`,
    );
    expect(explorerUrls.chiado(txHash)).toBe(
      `https://gnosis-chiado.blockscout.com/tx/${txHash}`,
    );
    expect(explorerUrls.opSepolia(txHash)).toBe(
      `https://sepolia-optimism.etherscan.io/tx/${txHash}`,
    );
    expect(explorerUrls.zkSyncSepolia(txHash)).toBe(
      `https://sepolia.explorer.zksync.io/tx/${txHash}`,
    );
    expect(explorerUrls.baseSepolia(txHash)).toBe(
      `https://sepolia.basescan.org/tx/${txHash}`,
    );
    expect(explorerUrls.specular(txHash)).toBe(
      `https://explorer.specular.network/tx/${txHash}`,
    );
    expect(explorerUrls.scrollSepolia(txHash)).toBe(
      `https://sepolia.scrollscan.com/tx/${txHash}`,
    );
    expect(explorerUrls.arbSepolia(txHash)).toBe(
      `https://sepolia.arbiscan.io/tx/${txHash}`,
    );
    expect(explorerUrls.artio(txHash)).toBe(
      `https://artio.beratrail.io/tx/${txHash}`,
    );
    expect(explorerUrls.hekla(txHash)).toBe(
      `https://hekla.taikoscan.io/tx/${txHash}`,
    );
  });
});
