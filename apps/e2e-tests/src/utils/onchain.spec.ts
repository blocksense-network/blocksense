import { Effect } from 'effect';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AggregatedDataFeedStoreConsumer } from '@blocksense/contracts/viem';

import type { FeedsValueAndRound } from './onchain';
import { getDataFeedsInfoFromNetwork } from './onchain';

describe('getDataFeedsInfoFromNetwork', () => {
  const mockConsumer = {
    getLatestSingleDataAndIndex: vi.fn(),
    getSingleDataAtIndex: vi.fn(),
  };

  const data =
    '0x0000000000000000000000000000000000000a3549cbad30000001986c265bf0';
  const value = 11223987629360;

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(
      AggregatedDataFeedStoreConsumer,
      'createConsumerByNetworkName',
    ).mockReturnValue(mockConsumer as any);
    vi.spyOn(
      AggregatedDataFeedStoreConsumer,
      'createConsumerByRpcUrl',
    ).mockReturnValue(mockConsumer as any);
  });

  it('fetches latest data when roundsInfo is not provided', async () => {
    mockConsumer.getLatestSingleDataAndIndex.mockResolvedValue({
      data,
      index: 42n,
    });

    const feedId = 1n;
    const result = await Effect.runPromise(
      getDataFeedsInfoFromNetwork([feedId], '0xabc123', 'mainnet'),
    );

    const expected: FeedsValueAndRound = {
      '1': { value, round: 42 },
    };

    expect(result).toEqual(expected);
    expect(mockConsumer.getLatestSingleDataAndIndex).toHaveBeenCalledWith(
      feedId,
    );
  });

  it('fetches specific round data when roundsInfo is provided', async () => {
    mockConsumer.getSingleDataAtIndex.mockResolvedValue(data);

    const feedId = 2n;
    const round = 99;
    const result = await Effect.runPromise(
      getDataFeedsInfoFromNetwork([feedId], '0xabc123', 'mainnet', {
        '2': round,
      }),
    );

    const expected: FeedsValueAndRound = {
      '2': { value, round: 99 },
    };

    expect(result).toEqual(expected);
    expect(mockConsumer.getSingleDataAtIndex).toHaveBeenCalledWith(
      feedId,
      round,
    );
  });
});
