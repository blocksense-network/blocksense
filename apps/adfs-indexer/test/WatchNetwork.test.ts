import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from '@effect/vitest';
import type * as EthersModule from 'ethers';
import { vi } from 'vitest';

import type { watchNetwork as WatchNetworkType } from '../src/commands/watcher/watcher';

import { INVALID_CALLDATA, VALID_CALLDATA } from './mocks/calldataDecoder';
import { jsonRpcProviderMock, setMockProvider } from './mocks/ethers';
import { MockJsonRpcProvider } from './mocks/jsonRpcProvider';

const resolvedGitRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../..',
);
const gitRootInitiallySet = process.env['GIT_ROOT'] !== undefined;
const initialGitRootValue = process.env['GIT_ROOT'];

if (!gitRootInitiallySet) {
  process.env['GIT_ROOT'] = resolvedGitRoot;
}
let watchNetwork: typeof WatchNetworkType;
let ethersModule: typeof EthersModule;

describe('WatchNetwork', () => {
  beforeAll(async () => {
    ({ watchNetwork } = await import('../src/commands/watcher/watcher'));
    ethersModule = await import('ethers');
  });

  afterAll(() => {
    if (gitRootInitiallySet) {
      process.env['GIT_ROOT'] = initialGitRootValue!;
    } else {
      delete process.env['GIT_ROOT'];
    }
  });

  let mockProvider: MockJsonRpcProvider;
  let originalSepoliaRpc: string | undefined;

  beforeEach(() => {
    originalSepoliaRpc = process.env['RPC_URL_ETHEREUM_SEPOLIA'];

    mockProvider = new MockJsonRpcProvider();

    process.env['RPC_URL_ETHEREUM_SEPOLIA'] =
      originalSepoliaRpc ?? 'https://mock-rpc.example';

    jsonRpcProviderMock.mockClear();
    setMockProvider(mockProvider);
  });

  afterEach(() => {
    if (originalSepoliaRpc === undefined) {
      delete process.env['RPC_URL_ETHEREUM_SEPOLIA'];
    } else {
      process.env['RPC_URL_ETHEREUM_SEPOLIA'] = originalSepoliaRpc;
    }

    setMockProvider(undefined);
  });

  it('should run without errors', async () => {
    const logSpy = vi.spyOn(console, 'log');

    await watchNetwork('ethereum-sepolia', true);

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Watching ADFS calldata on ethereum-sepolia for rpc:',
      ),
    );

    logSpy.mockRestore();
  });

  it('should throw an error when invalid network is provided', async () => {
    process.env['RPC_URL_INVALID_NETWORK'] = 'https://invalid-url';

    await expect(
      watchNetwork('invalid-network' as any, true),
    ).rejects.toThrow();

    delete process.env['RPC_URL_INVALID_NETWORK'];
  });

  it('should log an error for invalid calldata', async () => {
    const logSpy = vi.spyOn(console, 'log');
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    await watchNetwork('ethereum-sepolia', true);

    const { ethers } = ethersModule;
    const txHash = ethers.hexlify(ethers.randomBytes(32));

    mockProvider.getTransaction.mockResolvedValue({
      data: INVALID_CALLDATA,
      hash: txHash,
    });

    await mockProvider.emitLog({
      transactionHash: txHash,
      blockNumber: 123,
    });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Watching ADFS calldata on ethereum-sepolia for rpc:',
      ),
    );

    expect(logSpy).toHaveBeenCalledWith('\ntx hash: ', txHash);
    expect(errorSpy).toHaveBeenCalledWith('Error parsing calldata:', [
      'Invalid calldata',
    ]);

    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('should log success for valid calldata', async () => {
    const logSpy = vi.spyOn(console, 'log');
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    await watchNetwork('ethereum-sepolia', true);

    const { ethers } = ethersModule;
    const txHash = ethers.hexlify(ethers.randomBytes(32));

    mockProvider.getTransaction.mockResolvedValue({
      data: VALID_CALLDATA,
      hash: txHash,
    });

    await mockProvider.emitLog({
      transactionHash: txHash,
      blockNumber: 124,
    });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Watching ADFS calldata on ethereum-sepolia for rpc:',
      ),
    );

    expect(logSpy).toHaveBeenCalledWith('\nCalldata for block 124 is valid!');
    expect(errorSpy).not.toHaveBeenCalled();

    logSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
