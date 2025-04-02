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

  const addProvider = (
    key: string,
    type: CryptoProviderData['type'],
    value: any,
  ) => {
    if (value) {
      providers[type] ??= {};
      providers[type][key] = value;
    }
  };

  providersData.forEach(exchangeData => {
    addProvider(
      exchangeData.name,
      exchangeData.type,
      getProviderResourcesForPair(pair, exchangeData.data),
    );
  });

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

  if (keysOf(providerInfo).length === 0) {
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
