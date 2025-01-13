import { selectDirectory } from '@blocksense/base-utils/fs';

import { BinanceAssetsFetcher } from '../exchanges/binance/binance';
import { BybitAssetsFetcher } from '../exchanges/bybit/bybit';
import { CoinbaseExchangeAssetsFetcher } from '../exchanges/coinbase-exchange/coinbase-exchange';
import { OKXExchangeAssetsFetcher } from '../exchanges/okx/okx';
import { BitgetExchangeAssetsFetcher } from '../exchanges/bitget/bitget';
import { KuCoinExchangeAssetsFetcher } from '../exchanges/kucoin/kucoin';
import { MEXCExchangeAssetsFetcher } from '../exchanges/mexc/mexc';
import { GateIoExchangeAssetsFetcher } from '../exchanges/gate-io/gate-io';
import { CryptoComExchangeAssetsFetcher } from '../exchanges/crypto-com-exchange/crypto-com-exchange';
import { BinanceTRExchangeAssetsFetcher } from '../exchanges/binance-tr/binance-tr';
import { BinanceUSExchangeAssetsFetcher } from '../exchanges/binance-us/binance-us';
import { GeminiExchangeAssetsFetcher } from '../exchanges/gemini/gemini';
import { BitfinexExchangeAssetsFetcher } from '../exchanges/bitfinex/bitfinex';
import { CMCAssetFetcher } from '../aggregators/cmc';
import { KrakenAssetsFetcher } from '../exchanges/kraken/kraken';
import { UpbitAssetsFetcher } from '../exchanges/upbit/upbit';
import { dataProvidersDir } from '../../../paths';

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
    supportedBinanceUSExchangeSymbols,
    supportedGeminiExchangeSymbols,
    supportedBitfinexExchangeSymbols,
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
    new BinanceUSExchangeAssetsFetcher().fetchAssets(),
    new GeminiExchangeAssetsFetcher().fetchAssets(),
    new BitfinexExchangeAssetsFetcher().fetchAssets(),
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
      {
        content: { supportedBinanceUSExchangeSymbols },
        name: 'binance-us_symbols',
      },
      { content: { supportedGeminiExchangeSymbols }, name: 'gemini_symbols' },
      {
        content: { supportedBitfinexExchangeSymbols },
        name: 'bitfinex_symbols',
      },
      { content: { supportedUpbitSymbols }, name: 'upbit_symbols' },
      { content: { supportedKrakenSymbols }, name: 'kraken_symbols' },
      { content: { supportedCMCCurrencies }, name: 'cmc_currencies' },
    ];

    await Promise.all(symbolFiles.map(providerData => writeJSON(providerData)));
    console.log(
      `Fetching supported asset lists from ${symbolFiles.length} providers`,
    );
  }
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
