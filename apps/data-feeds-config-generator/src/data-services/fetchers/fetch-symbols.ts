import { selectDirectory } from '@blocksense/base-utils/fs';

import { fetchBinanceSymbolsInfo } from './binance';
import { fetchBybitSymbolsInfo } from './bybit';
import { getCMCCryptoList } from './cmc';
import { fetchKrakenSymbolsInfo } from './kraken';
import { fetchUpbitSymbolsInfo } from './upbit';
import { artifactsDir } from '../../paths';

export async function fetchSymbols() {
  const supportedBinanceSymbols = await fetchBinanceSymbolsInfo();
  const supportedBybitSymbols = await fetchBybitSymbolsInfo();
  const supportedUpbitSymbols = await fetchUpbitSymbolsInfo();
  const supportedKrakenSymbols = await fetchKrakenSymbolsInfo();
  const supportedCMCCurrencies = await getCMCCryptoList();

  {
    const { writeJSON } = selectDirectory(artifactsDir);
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
      `Symbols fetched successfully.\nData saved to ${artifactsDir}.`,
    );
  })
  .catch(e => {
    console.error(`Failed to fetch symbols: ${e}`);
  });
