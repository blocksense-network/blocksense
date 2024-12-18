import { selectDirectory } from '@blocksense/base-utils/fs';

import { BinanceAssetsFetcher } from './binance';
import { BybitAssetsFetcher } from './bybit';
import { CMCAssetFetcher } from './cmc';
import { KrakenAssetsFetcher } from './kraken';
import { UpbitAssetsFetcher } from './upbit';
import { dataProvidersDir } from '../../paths';

export async function fetchSymbols() {
  const [
    supportedBinanceSymbols,
    supportedBybitSymbols,
    supportedUpbitSymbols,
    supportedKrakenSymbols,
    supportedCMCCurrencies,
  ] = await Promise.all([
    new BinanceAssetsFetcher().fetchAssets(),
    new BybitAssetsFetcher().fetchAssets(),
    new UpbitAssetsFetcher().fetchAssets(),
    new KrakenAssetsFetcher().fetchAssets(),
    new CMCAssetFetcher().fetchAssets(),
  ]);

  {
    const { writeJSON } = selectDirectory(dataProvidersDir);
    const symbolFiles = [
      { content: { supportedBinanceSymbols }, name: 'binance_symbols' },
      { content: { supportedBybitSymbols }, name: 'bybit_symbols' },
      { content: { supportedUpbitSymbols }, name: 'upbit_symbols' },
      { content: { supportedKrakenSymbols }, name: 'kraken_symbols' },
      { content: { supportedCMCCurrencies }, name: 'cmc_currencies' },
    ];

    await Promise.all(symbolFiles.map(providerData => writeJSON(providerData)));
  }
}

console.log(
  'Fetching symbols from Binace, Bybit, Upbit, Kraken and CoinMarketCap...',
);
fetchSymbols()
  .then(() => {
    console.log(
      `Symbols fetched successfully.\nData saved to ${dataProvidersDir}.`,
    );
  })
  .catch(e => {
    console.error(`Failed to fetch symbols: ${e}`);
  });
