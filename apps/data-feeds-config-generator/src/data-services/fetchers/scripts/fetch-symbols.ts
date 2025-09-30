import { selectDirectory } from '@blocksense/base-utils/fs';

import { dataProvidersDir } from '../../../paths';
import * as exchangeFetchers from '../exchanges/index';

export async function fetchSymbols() {
  const exchangeSupportedSymbols = await Promise.all(
    Object.entries(exchangeFetchers).map(async ([name, fetcher]) => {
      const fetcherData = await new fetcher().fetchAssets();
      const fetcherName = `${name.split('AssetsFetcher')[0]}_assets`;
      return {
        fetcherName,
        fetcherData,
      };
    }),
  );

  const { writeJSON } = selectDirectory(dataProvidersDir);
  const symbolFiles = exchangeSupportedSymbols.map(exchangeSymbols => ({
    content: exchangeSymbols.fetcherData,
    name: exchangeSymbols.fetcherName,
  }));

  await Promise.all(symbolFiles.map(providerData => writeJSON(providerData)));
  console.log(
    `Fetching supported asset lists from ${symbolFiles.length} providers`,
  );
}

fetchSymbols()
  .then(() => {
    console.log(
      `Symbols fetched successfully.\nData saved to ${dataProvidersDir}.`,
    );
  })
  .catch(e => {
    console.error(`Failed to fetch symbols: ${e}`);
  });
