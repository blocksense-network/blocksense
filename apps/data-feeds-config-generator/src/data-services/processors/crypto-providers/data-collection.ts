import { keysOf } from '@blocksense/base-utils/array-iter';
import { assertNotNull } from '@blocksense/base-utils/assert';

import * as aggregatorFetchers from '../../fetchers/aggregators/index';
import * as exchangeFetchers from '../../fetchers/exchanges/index';

import type { CryptoProviderData } from './types';

export async function getCryptoProvidersData() {
  const fetcherCategories = {
    exchanges: exchangeFetchers,
    aggregators: aggregatorFetchers,
  };

  const allFetchers = { ...exchangeFetchers, ...aggregatorFetchers };
  const exchangeAssetsMap: CryptoProviderData[] = await Promise.all(
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
  return exchangeAssetsMap;
}
