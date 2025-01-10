import { selectDirectory } from '@blocksense/base-utils/fs';
import { NewFeed } from '@blocksense/config-types/data-feeds-config';

import { artifactsDir } from '../paths';
import { AssetInfo } from '../data-services/exchange-assets';
import { BinanceTRExchangeAssetsFetcher } from '../data-services/fetchers/exchanges/binance-tr/binance-tr';
import { BinanceUSExchangeAssetsFetcher } from '../data-services/fetchers/exchanges/binance-us/binance-us';
import { BinanceAssetsFetcher } from '../data-services/fetchers/exchanges/binance/binance';
import { BitfinexExchangeAssetsFetcher } from '../data-services/fetchers/exchanges/bitfinex/bitfinex';
import { BitgetExchangeAssetsFetcher } from '../data-services/fetchers/exchanges/bitget/bitget';
import { BybitAssetsFetcher } from '../data-services/fetchers/exchanges/bybit/bybit';
import { CoinbaseExchangeAssetsFetcher } from '../data-services/fetchers/exchanges/coinbase-exchange/coinbase-exchange';
import { CryptoComExchangeAssetsFetcher } from '../data-services/fetchers/exchanges/crypto-com-exchange/crypto-com-exchange';
import { GateIoExchangeAssetsFetcher } from '../data-services/fetchers/exchanges/gate-io/gate-io';
import { GeminiExchangeAssetsFetcher } from '../data-services/fetchers/exchanges/gemini/gemini';
import { KrakenAssetsFetcher } from '../data-services/fetchers/exchanges/kraken/kraken';
import { KuCoinExchangeAssetsFetcher } from '../data-services/fetchers/exchanges/kucoin/kucoin';
import { MEXCExchangeAssetsFetcher } from '../data-services/fetchers/exchanges/mexc/mexc';
import { OKXExchangeAssetsFetcher } from '../data-services/fetchers/exchanges/okx/okx';
import { UpbitAssetsFetcher } from '../data-services/fetchers/exchanges/upbit/upbit';
import { SimplifiedFeed } from './types';

export async function dataProvidersInjection(dataFeeds: SimplifiedFeed[]) {
  const exchangeFetchers = {
    binance: new BinanceAssetsFetcher(),
    bybit: new BybitAssetsFetcher(),
    coinbaseExchange: new CoinbaseExchangeAssetsFetcher(),
    okxExchange: new OKXExchangeAssetsFetcher(),
    bitgetExchange: new BitgetExchangeAssetsFetcher(),
    kuCoinExchange: new KuCoinExchangeAssetsFetcher(),
    mexcExchange: new MEXCExchangeAssetsFetcher(),
    gateIoExchange: new GateIoExchangeAssetsFetcher(),
    cryptoComExchange: new CryptoComExchangeAssetsFetcher(),
    binanceTRExchange: new BinanceTRExchangeAssetsFetcher(),
    binanceUSExchange: new BinanceUSExchangeAssetsFetcher(),
    geminiExchange: new GeminiExchangeAssetsFetcher(),
    bitfinexExchange: new BitfinexExchangeAssetsFetcher(),
    upbit: new UpbitAssetsFetcher(),
    kraken: new KrakenAssetsFetcher(),
  };

  // Fetch assets and populate the map
  const exchangeAssetsMap: { [key: string]: AssetInfo[] } = {};

  await Promise.all(
    Object.entries(exchangeFetchers).map(async ([key, fetcher]) => {
      exchangeAssetsMap[key] = await fetcher.fetchAssets();
    }),
  );

  // Filter out feeds without a quote pair
  const filteredFeeds = filterFeedsWithQuotes(dataFeeds);

  // Map feeds with providers
  const dataFeedsWithCryptoResources = await Promise.all(
    filteredFeeds.map(async feed => {
      const providers = getAllProvidersForFeed(feed, exchangeAssetsMap);
      return { ...feed, priceFeedInfo: { ...feed.priceFeedInfo, providers } };
    }),
  );

  // Write data to JSON file
  await saveToFile(
    dataFeedsWithCryptoResources,
    'dataFeedsWithCryptoResources',
  );

  return dataFeedsWithCryptoResources;
}

// Function to get all providers for a feed
function getAllProvidersForFeed(
  feed: SimplifiedFeed,
  exchangeAssets: { [key: string]: AssetInfo[] },
) {
  let providers = feed.priceFeedInfo.providers ?? {};

  const addProvider = (key: string, value: any) => {
    if (value) {
      providers = { ...providers, [key]: value };
    }
  };

  Object.entries(exchangeAssets).forEach(([key, assets]) => {
    addProvider(key, getResource(feed, assets));
  });

  return providers;
}

// Generalized resource finder
function getResource<T>(
  feed: SimplifiedFeed,
  assets: AssetInfo<Record<string, unknown>>[],
): Record<string, unknown> | undefined {
  return assets.find(symbol =>
    isPairSupportedByCryptoProvider(
      feed.priceFeedInfo.pair.base,
      feed.priceFeedInfo.pair.quote,
      symbol.pair.base,
      symbol.pair.quote,
    ),
  )?.data;
}

// Filter feeds that have a quote
function filterFeedsWithQuotes(feeds: SimplifiedFeed[]): SimplifiedFeed[] {
  return feeds.filter(feed => feed.priceFeedInfo.pair.quote);
}

// Save data to JSON file
async function saveToFile(data: any, fileName: string) {
  const { writeJSON } = selectDirectory(artifactsDir);
  await writeJSON({ content: { data }, name: fileName });
}

// Pair validation logic
function isPairSupportedByCryptoProvider(
  baseOrigin: string,
  quoteOrigin: string,
  baseProvider: string,
  quoteProvider: string,
): boolean {
  const isQuoteUSD = quoteOrigin === 'USD';
  const isCompatibleQuote =
    quoteProvider === quoteOrigin ||
    quoteProvider === 'USDT' ||
    quoteProvider === 'USDC';

  if (isQuoteUSD) {
    return baseOrigin === baseProvider && isCompatibleQuote;
  }

  return baseProvider === baseOrigin && quoteProvider === quoteOrigin;
}
