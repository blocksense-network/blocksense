import { keysOf } from '@blocksense/base-utils/array-iter';
import { Pair, CryptoPriceFeedsArgs } from '@blocksense/config-types';
import { AssetInfo } from '../../fetchers/exchanges/exchange-assets';
import { equalsCaseInsensitive } from '@blocksense/base-utils/string';
import { CryptoProviderData } from './types';
import { stableCoins } from './constants';

// Function to get all providers for a pair
export function getAllProvidersForPair(
  pair: Pair,
  providersData: CryptoProviderData[],
): CryptoPriceFeedsArgs {
  const providers: CryptoPriceFeedsArgs = {};

  for (const { name, type, data } of providersData) {
    const resources = getProviderResourcesForPair(pair, data);
    if (!resources) continue;
    providers[type] ??= {};
    providers[type][name] = resources;
  }

  return providers;
}

/**
 * Get provider resources for a given pair.
 *
 * This code takes an array of supported assets by an exchange and reduces it into a single object (`providerInfo`).
 * Each key in the `providerInfo` object corresponds to a key found in the `data` property of the assets.
 * The values are arrays that aggregate all the values associated with that key across all assets.
 * If no data is aggregated (i.e., `providerInfo` has no keys), the function returns `null`.
 * Otherwise, it returns the `providerInfo` object.
 *
 * If `excludePriceInfo` is true, the `price` key is excluded from the aggregation.
 */
export function getProviderResourcesForPair(
  pair: Pair,
  providerAssets: AssetInfo[],
  excludePriceInfo: boolean = true,
  includeStableCoins: boolean = true,
): Record<string, (string | number)[]> | null {
  const supportedAssets = providerAssets.filter(symbol =>
    isPairSupportedByCryptoProvider(pair, symbol.pair, includeStableCoins),
  );
  const providerInfo = supportedAssets.reduce(
    (acc, asset) => {
      keysOf(asset.data).forEach(key => {
        if (excludePriceInfo && key === 'price') return;
        const curr = acc[key] ?? [];
        acc[key] = [...curr, asset.data[key]].sort();
      });
      return acc;
    },
    {} as Record<string, (string | number)[]>,
  );

  if (keysOf(providerInfo).next().done) {
    return null;
  }

  return providerInfo;
}

// Pair validation logic
export function isPairSupportedByCryptoProvider(
  pair: Pair,
  dataProviderPair: Pair,
  includeStableCoins: boolean = true,
): boolean {
  const isBaseCompatible = equalsCaseInsensitive(
    pair.base,
    dataProviderPair.base,
  );
  const isCompatibleQuote =
    equalsCaseInsensitive(pair.quote, dataProviderPair.quote) ||
    (includeStableCoins &&
      pair.quote in stableCoins &&
      // Consider stablecoins quotings equivalent to fiat quotings:
      stableCoins[pair.quote as keyof typeof stableCoins].includes(
        dataProviderPair.quote,
      ));

  return isBaseCompatible && isCompatibleQuote;
}

// TODO: Add tests
/**
 * Retrieves price data for a specific trading pair from exchange providers.
 *
 * @param pair - The trading pair for which price data is being fetched.
 * @param providersData - An array of crypto provider data containing exchange information.
 * @returns An array of records where each record maps an exchange name to its price for the given pair.
 */
export function getExchangesPriceDataForPair(
  pair: Pair,
  providersData: CryptoProviderData[],
): Record<string, number>[] {
  const exchangesInfo = providersData.filter(
    ({ type }) => type === 'exchanges',
  );
  const exchangesPrices = exchangesInfo
    .map(({ name, data }) => {
      const exchangeDataForPair = getProviderResourcesForPair(
        pair,
        data,
        false,
        false,
      );
      if (!exchangeDataForPair) return null;

      const price = exchangeDataForPair[
        'price' as keyof typeof exchangeDataForPair
      ]?.[0] as number;
      return price !== undefined ? { [name]: price } : null;
    })
    .filter(entry => entry !== null);

  return exchangesPrices;
}

// TODO: Add tests
/**
 * Removes price outliers from the provided crypto provider data
 * based on the specified feed pair and outlier providers.
 *
 * @param providersData - An array of crypto provider data objects.
 * @param feedPair - The base and quote pair to filter outliers for.
 * @param outliners - An array of provider names considered as outliers.
 * @returns A new array of crypto provider data with outliers removed for the specified pair.
 */
export function removePriceOutliers(
  providersData: CryptoProviderData[],
  feedPair: Pair,
  outliners: string[],
) {
  const { base, quote } = feedPair;
  const cleared = providersData.map(provider => {
    if (outliners.includes(provider.name)) {
      return {
        ...provider,
        data: provider.data.filter(
          ({ pair }) => pair.base !== base || pair.quote !== quote,
        ),
      };
    }
    return provider;
  });
  return cleared;
}
