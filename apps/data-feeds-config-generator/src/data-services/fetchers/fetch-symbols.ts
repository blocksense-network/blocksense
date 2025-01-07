import { selectDirectory } from '@blocksense/base-utils/fs';

import { BinanceAssetsFetcher } from './binance';
import { BybitAssetsFetcher } from './bybit';
import { CoinbaseExchangeAssetsFetcher } from './coinbase-exchange';
import { OKXExchangeAssetsFetcher } from './okx';
import { BitgetExchangeAssetsFetcher } from './bitget';
import { KuCoinExchangeAssetsFetcher } from './kucoin';
import { MEXCExchangeAssetsFetcher } from './mexc';
import { GateIoExchangeAssetsFetcher } from './gate-io';
import { CryptoComExchangeAssetsFetcher } from './crypto-com-exchange';
import { BinanceTRExchangeAssetsFetcher } from './binance-tr';
import { CMCAssetFetcher } from './cmc';
import { KrakenAssetsFetcher } from './kraken';
import { UpbitAssetsFetcher } from './upbit';
import { dataProvidersDir } from '../../paths';

export async function fetchSymbols() {
  const [
    supportedBinanceSymbols,
    supportedBybitSymbols,
    supportedCoinbaseExchangeSymbols,
    supportedOKXExchangeSymbols,
    supportedBitgetExchangeSymbols,
    supportedKuCoinExchangeSymbols,
    supportedMEXCExchangeSymbols,
    supportedGateIoExchangeSymbols,
    supportedCryptoComExchangeSymbols,
    supportedBinanceTRExchangeSymbols,
    supportedUpbitSymbols,
    supportedKrakenSymbols,
    supportedCMCCurrencies,
  ] = await Promise.all([
    new BinanceAssetsFetcher().fetchAssets(),
    new BybitAssetsFetcher().fetchAssets(),
    new CoinbaseExchangeAssetsFetcher().fetchAssets(),
    new OKXExchangeAssetsFetcher().fetchAssets(),
    new BitgetExchangeAssetsFetcher().fetchAssets(),
    new KuCoinExchangeAssetsFetcher().fetchAssets(),
    new MEXCExchangeAssetsFetcher().fetchAssets(),
    new GateIoExchangeAssetsFetcher().fetchAssets(),
    new CryptoComExchangeAssetsFetcher().fetchAssets(),
    new BinanceTRExchangeAssetsFetcher().fetchAssets(),
    new UpbitAssetsFetcher().fetchAssets(),
    new KrakenAssetsFetcher().fetchAssets(),
    new CMCAssetFetcher().fetchAssets(),
  ]);

  {
    const { writeJSON } = selectDirectory(dataProvidersDir);
    const symbolFiles = [
      { content: { supportedBinanceSymbols }, name: 'binance_symbols' },
      { content: { supportedBybitSymbols }, name: 'bybit_symbols' },
      {
        content: { supportedCoinbaseExchangeSymbols },
        name: 'coinbase_exchange_symbols',
      },
      {
        content: { supportedOKXExchangeSymbols },
        name: 'okx_symbols',
      },
      { content: { supportedBitgetExchangeSymbols }, name: 'bitget_symbols' },
      { content: { supportedKuCoinExchangeSymbols }, name: 'kucoin_symbols' },
      { content: { supportedMEXCExchangeSymbols }, name: 'mexc_symbols' },
      { content: { supportedGateIoExchangeSymbols }, name: 'gate-io_symbols' },
      {
        content: { supportedCryptoComExchangeSymbols },
        name: 'crypto-com_symbols',
      },
      {
        content: { supportedBinanceTRExchangeSymbols },
        name: 'binance-tr_symbols',
      },
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
