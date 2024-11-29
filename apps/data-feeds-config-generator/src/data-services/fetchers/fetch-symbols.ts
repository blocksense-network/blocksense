import { fetchBinanceSymbolsInfo } from './binance';
import { fetchBybitSymbolsInfo } from './bybit';
import { getCMCCryptoList } from './cmc';
import { fetchKrakenSymbolsInfo } from './kraken';
import { fetchUpbitSymbolsInfo } from './upbit';

import { artifactsDir } from '../../paths';

export async function fetchSymbols() {
  await fetchBinanceSymbolsInfo();
  await fetchBybitSymbolsInfo();
  await fetchUpbitSymbolsInfo();
  await fetchKrakenSymbolsInfo();
  await getCMCCryptoList();
}

console.log(
  'Fetching symbols from Binace, Bybit, Upbit, Kraken and CoinMarketCap...',
);
fetchSymbols()
  .then(() => {
    console.log(
      `Symbols fetched successfully.\n Data saved to ${artifactsDir}.`,
    );
  })
  .catch(e => {
    console.error(`Failed to fetch symbols: ${e}`);
  });
