import yahooFinance from 'yahoo-finance2';

import { assertNotNull } from '@blocksense/base-utils/assert';
import { selectDirectory } from '@blocksense/base-utils/fs';
import { rootDir } from '@blocksense/base-utils/env';
import { filterAsync } from '@blocksense/base-utils/async';

import {
  CMCInfo,
  Feed,
  FeedsConfig,
  FeedType,
  Pair,
  RawDataFeeds,
  ChainLinkFeedInfo,
  decodeChainLinkFeedsInfo,
  decodeCMCInfo,
  decodeScript,
} from './types';
import { artifactsDir, chainlinkFeedsDir } from './paths';

const defaultFeedInfo = {
  report_interval_ms: 60_000,
  first_report_start_time: {
    secs_since_epoch: 0,
    nanos_since_epoch: 0,
  },
  quorum_percentage: 0.6,
} satisfies Partial<Feed>;

function feedFromChainLinkFeedInfo(
  data: ChainLinkFeedInfo,
): Omit<Feed, 'id' | 'script'> {
  const [base, quote] = data.name.split(' / ');
  return {
    name: base,
    fullName: data.assetName,
    description: data.name,
    type: data.feedType,
    decimals: data.decimals,
    pair: { base, quote },
    ...defaultFeedInfo,
  };
}

async function getCMCCryptoList(): Promise<readonly CMCInfo[]> {
  const url = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/map';
  const headers = {
    'X-CMC_PRO_API_KEY': assertNotNull(process.env['CMC_API_KEY']),
    Accept: 'application/json',
  };

  const fullUrl = `${url}`;

  const response = await fetch(fullUrl, { headers });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const typedData = (await response.json()) as { data: unknown[] };

  const supportedCMCCurrencies = decodeCMCInfo(typedData.data);

  {
    const { writeJSON } = selectDirectory(artifactsDir);
    await writeJSON({
      content: { supportedCMCCurrencies },
      name: 'cmc_currencies',
    });
  }

  return supportedCMCCurrencies;
}

async function isFeedSupportedByYF(symbol: string) {
  try {
    const quote = await yahooFinance.quote(
      symbol,
      {},
      { validateResult: false },
    );
    if (!quote && Number.isFinite(quote.regularMarketPrice)) {
      console.error(`No quote for symbol: ${symbol}`);
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

async function writeFeedConfigToFile(
  feedConfig: FeedsConfig,
  filePath: string,
) {
  const { writeJSON } = selectDirectory(filePath);

  await writeJSON({
    content: feedConfig,
    name: 'feeds_config',
  });
}

async function isFeedSupported(
  feed: {
    type: FeedType;
    pair: Pair;
    description: string;
    fullName: string;
    cmc_id?: number;
    yf_symbol?: string;
  },
  supportedCMCCurrencies: readonly CMCInfo[],
): Promise<boolean> {
  const cmcSupported = supportedCMCCurrencies.find(
    currency =>
      currency.symbol === feed.pair.base &&
      (feed.type === 'Crypto' || feed.type === ''),
  );
  if (cmcSupported != null) {
    feed.cmc_id = cmcSupported.id;
    feed.type = 'Crypto';
    return true;
  }

  const yfSupported = await isFeedSupportedByYF(feed.pair.base);
  if (yfSupported) {
    if (
      feed.type === 'Currency' ||
      feed.type === 'Forex' ||
      feed.type === 'Fiat' ||
      feed.type === ''
    ) {
      feed.yf_symbol = `${feed.pair.base}${feed.pair.quote}=X`;
    }
    return true;
  }

  return false;
}

async function collectRawDataFeeds(directoryPath: string) {
  const { readAllJSONFiles } = selectDirectory(directoryPath);

  const rawDataFeeds: RawDataFeeds = {};

  for (const { base, data } of await readAllJSONFiles()) {
    const info = decodeChainLinkFeedsInfo(data);

    for (const feed of info) {
      const feedName = feed.name;
      rawDataFeeds[feedName] ??= { networks: {} };
      if (rawDataFeeds[feedName].networks[base]) {
        console.error(`Duplicate feed for '${feedName}' on network '${base}'`);
      }
      rawDataFeeds[feedName].networks[base] = feed;
    }
  }

  {
    const { writeJSON } = selectDirectory(artifactsDir);
    await writeJSON({
      content: rawDataFeeds,
      name: 'raw_chainlink_feeds',
    });
  }

  return rawDataFeeds;
}

async function generateFeedConfig(
  rawDataFeeds: RawDataFeeds,
): Promise<FeedsConfig> {
  const allPossibleFeeds: Omit<Feed, 'id' | 'script'>[] = Object.entries(
    rawDataFeeds,
  ).map(([_feedName, feedData]) => {
    // TODO: Check if the feed data for all networks is the same
    const data = Object.entries(feedData.networks)[0][1];

    return {
      ...feedFromChainLinkFeedInfo(data),
    };
  });

  const supportedCMCCurrencies = await getCMCCryptoList();

  const usdPairFeeds = allPossibleFeeds.filter(
    feed => feed.pair.quote === 'USD',
  );
  const feeds = await filterAsync(usdPairFeeds, feed =>
    isFeedSupported(feed, supportedCMCCurrencies),
  );
  const feedsWithIdAndScript = feeds.map((feed, id) => ({
    id,
    ...feed,
    script: decodeScript('cmc_id' in feed ? 'CoinMarketCap' : 'YahooFinance'),
  }));

  return { feeds: feedsWithIdAndScript };
}

async function main(chainlinkFeedsDir: string) {
  const rawDataFeeds: RawDataFeeds =
    await collectRawDataFeeds(chainlinkFeedsDir);

  const feedConfig = await generateFeedConfig(rawDataFeeds);

  await writeFeedConfigToFile(feedConfig, artifactsDir);
  await writeFeedConfigToFile(feedConfig, `${rootDir}/config`);
}

await main(chainlinkFeedsDir);
