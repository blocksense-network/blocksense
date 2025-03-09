import { selectDirectory } from '@blocksense/base-utils/fs';

import {
  Pair,
  ProvidersResources,
} from '@blocksense/config-types/data-feeds-config';
import { keysOf } from '@blocksense/base-utils/array-iter';

import { artifactsDir } from '../paths';
import { AssetInfo } from '../data-services/exchange-assets';
import * as aggregatorFetchers from '../data-services/fetchers/aggregators/index';
import * as exchangeFetchers from '../data-services/fetchers/exchanges/index';
import { SimplifiedFeed } from './types';
import { assertNotNull } from '@blocksense/base-utils/assert';

export async function addDataProviders(dataFeeds: SimplifiedFeed[]) {
  const fetcherCategories = {
    exchanges: exchangeFetchers,
    aggregators: aggregatorFetchers,
  };
  const allFetchers = { ...exchangeFetchers, ...aggregatorFetchers };
  const exchangeAssetsMap: ExchangeData[] = await Promise.all(
    Object.entries(allFetchers).map(async ([name, fetcher]) => {
      const fetcherData = await new fetcher().fetchAssets();
      const fetcherName = name.split('AssetsFetcher')[0];
      return {
        name: fetcherName,
        type: assertNotNull(
          keysOf(fetcherCategories).find(
            category => name in fetcherCategories[category],
          ),
        ),
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
      return {
        ...feed,
        additional_feed_info: {
          ...feed.additional_feed_info,
          arguments: providers,
        },
      };
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
  const providers: ProvidersResources = {};

  const addProvider = (key: string, type: ExchangeData['type'], value: any) => {
    if (value) {
      providers[type] ??= {};
      providers[type][key] = value;
    }
  };

  exchangeAssets.forEach(exchangeData => {
    addProvider(
      exchangeData.name,
      exchangeData.type,
      getPriceFeedDataProvidersInfo(feed, exchangeData.data),
    );
  });

  return providers;
}

/**
 * Get provider resources for a given feed.
 *
 * This code takes an array of supported assets by an exchange and reduces it into a single object (`providerInfo`).
 * Each key in the `providerInfo` object corresponds to a key found in the `data` property of the assets.
 * The values are arrays that aggregate all the values associated with that key across all assets.
 * If no data is aggregated (i.e., `providerInfo` has no keys), the function returns `null`.
 * Otherwise, it returns the `providerInfo` object.
 */
function getPriceFeedDataProvidersInfo<T>(
  feed: SimplifiedFeed,
  exchangeAssets: AssetInfo[],
): Record<string, string[]> | null {
  const supportedAssets = exchangeAssets.filter(symbol =>
    isPairSupportedByCryptoProvider(
      feed.additional_feed_info.pair,
      symbol.pair,
    ),
  );
  const providerInfo = supportedAssets.reduce(
    (acc, asset) => {
      keysOf(asset.data).forEach(key => {
        const curr = acc[key] ?? [];
        acc[key] = [...curr, asset.data[key]].sort();
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
  return feeds.filter(feed => feed.additional_feed_info.pair.quote);
}

// Save data to JSON file
async function saveToFile(data: any, fileName: string) {
  const { writeJSON } = selectDirectory(artifactsDir);
  await writeJSON({ content: { data }, name: fileName });
}

// Placeholder for now; to be extended later
export const stableCoins = {
  USD: ['USDT', 'USDC'],
  EUR: ['EURC', 'EURS', 'EURt'],
};

function equalsCaseInsensitive(a: string, b: string) {
  // FIXME: find why the following causes the program to hang:
  // return a.localeCompare(b, undefined, { sensitivity: 'base' }) === 0;
  return a.toLowerCase() === b.toLowerCase();
}

// Pair validation logic
function isPairSupportedByCryptoProvider(
  oracleFeedPair: Pair,
  dataProviderPair: Pair,
): boolean {
  const isBaseCompatible = equalsCaseInsensitive(
    oracleFeedPair.base,
    dataProviderPair.base,
  );
  const isCompatibleQuote =
    equalsCaseInsensitive(oracleFeedPair.quote, dataProviderPair.quote) ||
    (oracleFeedPair.quote in stableCoins &&
      // Consider stablecoins quotings equivalent to fiat quotings:
      stableCoins[oracleFeedPair.quote as keyof typeof stableCoins].includes(
        dataProviderPair.quote,
      ));

  return isBaseCompatible && isCompatibleQuote;
}

type ExchangeData = {
  name: string;
  type: 'exchanges' | 'aggregators';
  data: AssetInfo[];
};
