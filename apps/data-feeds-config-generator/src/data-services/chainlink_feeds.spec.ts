import { describe, expect, test } from 'vitest';
import {
  AggregatedFeedInfo,
  getFieldFromAggregatedData,
} from './chainlink_feeds';
import { get } from 'http';

describe('Tests for `getFieldFromAggregatedData`', async () => {
  const testData = {
    compareOffchain: '',
    contractAddress: {
      'avalanche-fuji': '0x04c5046A1f4E3fFf094c26dFCAA75eF293932f18',
      'avalanche-mainnet': '0x6576f172a3DfB3B78Eb028773ec5c1Aa676E4Fb1',
    },
    contractType: '',
    contractVersion: {
      'avalanche-fuji': 4,
      'avalanche-mainnet': 6,
    },
    decimalPlaces: null,
    ens: 'link-avax',
    formatDecimalPlaces: null,
    healthPrice: '',
    heartbeat: 86400,
    history: {
      'avalanche-fuji': false,
      'avalanche-mainnet': null,
    },
    multiply: '1000000000000000000',
    name: 'LINK / AVAX',
    pair: {
      'avalanche-fuji': ['', ''],
      'avalanche-mainnet': ['LINK', 'AVAX'],
    },
    path: 'link-avax',
    proxyAddress: {
      'avalanche-fuji': '0x79c91fd4F8b3DaBEe17d286EB11cEE4D83521775',
      'avalanche-mainnet': '0x1b8a25F73c9420dD507406C3A3816A276b62f56a',
    },
    threshold: {
      'avalanche-fuji': 1,
      'avalanche-mainnet': 0.5,
    },
    valuePrefix: '',
    assetName: {
      'avalanche-fuji': '',
      'avalanche-mainnet': 'Chainlink',
    },
    feedType: {
      'avalanche-fuji': '',
      'avalanche-mainnet': 'Crypto',
    },
    decimals: 18,
    docs: {
      'avalanche-fuji': {},
      'avalanche-mainnet': {
        assetName: 'Chainlink',
        baseAsset: 'LINK',
        quoteAsset: 'AVAX',
        marketHours: 'Crypto',
        productType: 'Price',
        feedType: 'Crypto',
      },
    },
  };

  test('should work getting unique fields', () => {
    expect(
      getFieldFromAggregatedData(
        testData as unknown as AggregatedFeedInfo,
        'decimals',
      ),
    ).toBe(testData.decimals);

    expect(
      getFieldFromAggregatedData(
        testData as unknown as AggregatedFeedInfo,
        'name',
      ),
    ).toBe(testData.name);
  });

  test('should work getting aggregated fields', () => {
    {
      const expectedResult = testData.feedType['avalanche-mainnet'];
      expect(
        getFieldFromAggregatedData(
          testData as unknown as AggregatedFeedInfo,
          'feedType',
        ),
      ).toBe(expectedResult);
    }
    {
      const expectedResult = testData.threshold['avalanche-fuji'];
      expect(
        getFieldFromAggregatedData(
          testData as unknown as AggregatedFeedInfo,
          'threshold',
        ),
      ).toBe(expectedResult);
    }
  });

  test('should work getting aggregated fields when they are arrays', () => {
    {
      const expectedResult = testData.pair['avalanche-mainnet'];
      expect(
        getFieldFromAggregatedData(
          testData as unknown as AggregatedFeedInfo,
          'pair',
        ),
      ).toBe(expectedResult);
    }
    {
      testData.pair = {
        'avalanche-fuji': ['', ''],
        'avalanche-mainnet': ['', ''],
      };

      expect(
        getFieldFromAggregatedData(
          testData as unknown as AggregatedFeedInfo,
          'pair',
        ),
      ).toBeUndefined();
    }
  });

  test('should work getting fields from docs', () => {
    {
      expect(
        getFieldFromAggregatedData(
          testData as unknown as AggregatedFeedInfo,
          'docs',
          'assetName',
        ),
      ).toBe(testData.docs['avalanche-mainnet'].assetName);
    }
  });

  test('should throw an error when inDocsField is not provided', () => {
    expect(() =>
      getFieldFromAggregatedData(
        testData as unknown as AggregatedFeedInfo,
        'docs',
      ),
    ).toThrowError('inDocsField is required when field is "docs"');
  });
});
