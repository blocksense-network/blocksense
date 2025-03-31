import { keysOf } from '@blocksense/base-utils/array-iter';
import { assertNotNull } from '@blocksense/base-utils/assert';
import { selectDirectory } from '@blocksense/base-utils/fs';

import * as aggregatorFetchers from '../src/data-services/fetchers/aggregators/index';
import * as exchangeFetchers from '../src/data-services/fetchers/exchanges/index';
import { ProviderData } from '../src/generation/initial/data-providers';
import { artifactsDir } from '../src/paths';

async function main() {
  const fetcherCategories = {
    exchanges: exchangeFetchers,
    aggregators: aggregatorFetchers,
  };

  const allFetchers = { ...exchangeFetchers, ...aggregatorFetchers };
  const exchangeAssetsMap: ProviderData[] = await Promise.all(
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

  const { writeJSON } = selectDirectory(artifactsDir);
  await writeJSON({
    name: 'providers_data',
    content: exchangeAssetsMap,
  });
}

await main();
