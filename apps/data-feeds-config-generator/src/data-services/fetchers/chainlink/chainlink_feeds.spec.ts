import { describe, expect, test } from 'vitest';

import type { AggregatedFeedInfo } from './chainlink_feeds';
import {
  getBaseQuote,
  getFieldFromAggregatedData,
  getHighestDecimals,
} from './chainlink_feeds';

describe('Tests for functions over Aggregated Data', async () => {
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
  } as unknown as AggregatedFeedInfo;

  describe('Tests for `getFieldFromAggregatedData`', async () => {
    test('should work getting unique fields', () => {
      expect(getFieldFromAggregatedData(testData, 'decimals')).toBe(
        testData.decimals,
      );

      expect(getFieldFromAggregatedData(testData, 'name')).toBe(testData.name);
    });

    test('should work getting aggregated fields', () => {
      {
        const expectedResult = testData.feedType['avalanche-mainnet'];
        expect(getFieldFromAggregatedData(testData, 'feedType')).toBe(
          expectedResult,
        );
      }
      {
        const expectedResult = testData.threshold['avalanche-fuji'];
        expect(getFieldFromAggregatedData(testData, 'threshold')).toBe(
          expectedResult,
        );
      }
    });

    test('should work getting aggregated fields when they are arrays', () => {
      {
        const expectedResult = testData.pair['avalanche-mainnet'];
        expect(getFieldFromAggregatedData(testData, 'pair')).toBe(
          expectedResult,
        );
      }
      {
        const testDataClone = structuredClone(testData);
        testDataClone.pair = {
          'avalanche-fuji': ['', ''],
          'avalanche-mainnet': ['', ''],
        } as any;

        expect(
          getFieldFromAggregatedData(testDataClone, 'pair'),
        ).toBeUndefined();
      }
    });

    test('should work getting fields from docs', () => {
      {
        expect(getFieldFromAggregatedData(testData, 'docs', 'assetName')).toBe(
          testData.docs['avalanche-mainnet'].assetName,
        );
      }
    });

    test('should throw an error when inDocsField is not provided', () => {
      expect(() => getFieldFromAggregatedData(testData, 'docs')).toThrowError(
        'inDocsField is required when field is "docs"',
      );
    });
  });

  describe('Tests for `getBaseQuote`', async () => {
    test('should work getting pair from docs field', () => {
      const { base, quote } = getBaseQuote(testData);
      expect({ base, quote }).toEqual({
        base: testData.docs['avalanche-mainnet'].baseAsset,
        quote: testData.docs['avalanche-mainnet'].quoteAsset,
      });
    });

    test('should log warning and return empty pair if there is inconsistent', () => {
      const testPair = ['', ''];
      const testDataClone = structuredClone(testData);

      testDataClone.docs = {
        'avalanche-fuji': {
          assetName: 'Chainlink',
          baseAsset: 'tLINK',
        },
        'avalanche-mainnet': {
          assetName: 'Chainlink',
          quoteAsset: 'tAVAX',
        },
      } as any;

      const { base, quote } = getBaseQuote(testDataClone);
      expect({ base, quote }).toEqual({
        base: testPair[0],
        quote: testPair[1],
      });
    });

    test('should work getting pair from pair field', () => {
      const testPair = ['tLINK', 'tAVAX'];
      const testDataClone = structuredClone(testData);

      testDataClone.docs = {} as any;
      {
        testDataClone.pair = testPair as any;
        const { base, quote } = getBaseQuote(testDataClone);
        expect({ base, quote }).toEqual({
          base: testPair[0],
          quote: testPair[1],
        });
      }
      {
        testDataClone.pair = {
          'avalanche-fuji': ['', ''],
          'avalanche-mainnet': testPair,
        } as any;

        const { base, quote } = getBaseQuote(testDataClone);
        expect({ base, quote }).toEqual({
          base: testPair[0],
          quote: testPair[1],
        });
      }
    });

    test('should work getting pair from name field', () => {
      const testPair = ['LINK', 'AVAX'];
      const testDataClone = structuredClone(testData);

      testDataClone.docs = {} as any;
      testDataClone.pair = {} as any;
      {
        const { base, quote } = getBaseQuote(testDataClone);
        expect({ base, quote }).toEqual({
          base: testPair[0],
          quote: testPair[1],
        });
      }
    });

    test("should return empty base and quote if don't fined fields", () => {
      const testDataClone = structuredClone(testData);

      testDataClone.docs = {} as any;
      testDataClone.pair = {} as any;
      testDataClone.name = '' as any;
      const { base, quote } = getBaseQuote(testDataClone);
      expect({ base, quote }).toEqual({ base: '', quote: '' });
    });
  });

  describe('Tests for `getHighestDecimals`', async () => {
    test('should work getting decimals when they are not an object', () => {
      const decimals = getHighestDecimals(testData);
      expect(decimals).toBe(testData.decimals);
    });

    test('should work getting decimals when they are an object', () => {
      const testDataClone = structuredClone(testData);

      testDataClone.decimals = {
        'avalanche-fuji': 2,
        'avalanche-mainnet': 4,
      } as any;

      const decimals = getHighestDecimals(testDataClone);
      expect(decimals).toBe(4);
    });
  });
});
