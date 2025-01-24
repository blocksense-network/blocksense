import { selectDirectory } from '@blocksense/base-utils/fs';

import {
  Pair,
  ProvidersResources,
} from '@blocksense/config-types/data-feeds-config';
import { keysOf } from '@blocksense/base-utils/array-iter';

import { artifactsDir } from '../paths';
import { AssetInfo } from '../data-services/exchange-assets';
import * as exchangeFetchers from '../data-services/fetchers/exchanges/index';
import { SimplifiedFeed } from './types';

export async function dataProvidersInjection(dataFeeds: SimplifiedFeed[]) {
  const exchangeAssetsMap: ExchangeData[] = await Promise.all(
    Object.entries(exchangeFetchers).map(async ([name, fetcher]) => {
      const fetcherData = await new fetcher().fetchAssets();
      const fetcherName = name.split('AssetsFetcher')[0];
      return {
        name: fetcherName,
        data: fetcherData,
      };
    }),
  );

  // Filter out feeds without a quote pair
  const filteredFeeds = filterFeedsWithQuotes(dataFeeds);

  // Map feeds with providers
  const dataFeedsWithCryptoResources = await Promise.all(
    filteredFeeds.map(async feed => {
      const providers = getAllProvidersForFeed(feed, exchangeAssetsMap);
      return { ...feed, priceFeedInfo: { ...feed.priceFeedInfo, providers } };
    }),
  );

  // Write data to JSON file
  await saveToFile(
    dataFeedsWithCryptoResources,
    'dataFeedsWithCryptoResources',
  );

  return dataFeedsWithCryptoResources;
}

// Function to get all providers for a feed
function getAllProvidersForFeed(
  feed: SimplifiedFeed,
  exchangeAssets: ExchangeData[],
): ProvidersResources {
  let providers = feed.priceFeedInfo.providers ?? {};

  const addProvider = (key: string, value: any) => {
    if (value) {
      providers = { ...providers, [key]: value };
    }
  };

  exchangeAssets.forEach(exchangeData => {
    addProvider(exchangeData.name, getAssetMetadata(feed, exchangeData.data));
  });

  return providers;
}

/**
 * Generalized resource finder
 *
 * This code takes an array of supported assets by an exchange and reduces it into a single object (`providerInfo`).
 * Each key in the `providerInfo` object corresponds to a key found in the `data` property of the assets.
 * The values are arrays that aggregate all the values associated with that key across all assets.
 * If no data is aggregated (i.e., `providerInfo` has no keys), the function returns `null`.
 * Otherwise, it returns the `providerInfo` object.
 */
function getAssetMetadata<T>(
  feed: SimplifiedFeed,
  exchangeAssets: AssetInfo[],
): Record<string, string[]> | null {
  const supportedAssets = exchangeAssets.filter(symbol =>
    isPairSupportedByCryptoProvider(feed.priceFeedInfo.pair, symbol.pair),
  );
  const providerInfo = supportedAssets.reduce(
    (acc, asset) => {
      keysOf(asset.data).forEach(key => {
        const curr = acc[key] ?? [];
        acc[key] = [...curr, asset.data[key]];
      });
      return acc;
    },
    {} as Record<string, string[]>,
  );

  if (keysOf(providerInfo).length === 0) {
    return null;
  }

  return providerInfo;
}

// Filter feeds that have a quote
function filterFeedsWithQuotes(feeds: SimplifiedFeed[]): SimplifiedFeed[] {
  return feeds.filter(feed => feed.priceFeedInfo.pair.quote);
}

// Save data to JSON file
async function saveToFile(data: any, fileName: string) {
  const { writeJSON } = selectDirectory(artifactsDir);
  await writeJSON({ content: { data }, name: fileName });
}

// Pair validation logic
function isPairSupportedByCryptoProvider(
  oracleFeedPair: Pair,
  dataProviderPair: Pair,
): boolean {
  const stableCoins = {
    USD: ['USDT', 'USDC'],
  };

  const isBaseCompatible = oracleFeedPair.base === dataProviderPair.base;
  const isCompatibleQuote =
    oracleFeedPair.quote === dataProviderPair.quote ||
    (oracleFeedPair.quote in stableCoins &&
      // Consider stablecoins quotings equivalent to fiat quotings:
      stableCoins[oracleFeedPair.quote as keyof typeof stableCoins].includes(
        dataProviderPair.quote,
      ));

  return isBaseCompatible && isCompatibleQuote;
}

type ExchangeData = {
  name: string;
  data: AssetInfo[];
};
