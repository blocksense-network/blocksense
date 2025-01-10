import { selectDirectory } from '@blocksense/base-utils/fs';

import { artifactsDir } from '../paths';
import { AssetInfo } from '../data-services/exchange-assets';
import * as exchangeFetchers from '../data-services/fetchers/exchanges/index';
import { SimplifiedFeed } from './types';
import { Pair } from '@blocksense/config-types/data-feeds-config';

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
) {
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

// Generalized resource finder
function getAssetMetadata<T>(
  feed: SimplifiedFeed,
  assets: AssetInfo[],
): Record<string, unknown> | undefined {
  return assets.find(symbol =>
    isPairSupportedByCryptoProvider(feed.priceFeedInfo.pair, symbol.pair),
  )?.data;
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
