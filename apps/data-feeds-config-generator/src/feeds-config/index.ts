import { filterAsync } from '@blocksense/base-utils/async';

import { Feed, FeedsConfig, FeedType, Pair, decodeScript } from './types';

import {
  ChainLinkFeedInfo,
  RawDataFeeds,
  CMCInfo,
} from '../data-services/types';
import { getCMCCryptoList } from '../data-services/cmc';
import { isFeedSupportedByYF } from '../data-services/yf';
import { selectDirectory } from '@blocksense/base-utils/fs';
import { artifactsDir } from '../paths';

const defaultFeedInfo = {
  report_interval_ms: 300_000,
  first_report_start_time: {
    secs_since_epoch: 0,
    nanos_since_epoch: 0,
  },
  quorum_percentage: 1,
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
    resources: {},
    ...defaultFeedInfo,
  };
}
async function isFeedSupported(
  feed: {
    type: FeedType;
    pair: Pair;
    description: string;
    fullName: string;
    resources: any;
  },
  supportedCMCCurrencies: readonly CMCInfo[],
): Promise<boolean> {
  const cmcSupported = supportedCMCCurrencies.find(
    currency =>
      currency.symbol === feed.pair.base &&
      (feed.type === 'Crypto' || feed.type === ''),
  );
  if (cmcSupported != null) {
    feed.resources.cmc_id = cmcSupported.id;
    feed.resources.cmc_quote = feed.pair.base;
    feed.type = 'Crypto';
    return true;
  }

  const yfSupported = await isFeedSupportedByYF(feed.pair.base);
  if (yfSupported) {
    feed.resources.yf_symbol = feed.pair.base;
    if (
      feed.type === 'Currency' ||
      feed.type === 'Forex' ||
      feed.type === 'Fiat' ||
      feed.type === ''
    ) {
      feed.resources.yf_symbol = `${feed.pair.base}${feed.pair.quote}=X`;
    }
    return true;
  }

  return false;
}
export async function generateFeedConfig(
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
    script: decodeScript(
      'cmc_id' in feed.resources ? 'CoinMarketCap' : 'YahooFinance',
    ),
  }));

  {
    const { writeJSON } = selectDirectory(artifactsDir);
    await writeJSON({
      content: { feeds: feedsWithIdAndScript },
      name: 'feeds_config',
    });
  }

  return { feeds: feedsWithIdAndScript };
}
