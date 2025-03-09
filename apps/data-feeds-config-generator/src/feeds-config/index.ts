import {
  NewFeed,
  NewFeedsConfig,
} from '@blocksense/config-types/data-feeds-config';

import { RawDataFeeds } from '../data-services/types';
import { SimplifiedFeed } from './types';
import { addDataProviders } from './data-providers';
import {
  chainLinkFileNameIsNotTestnet,
  getCLFeedsOnMainnet,
} from './utils/chainlink';
import {
  getUniqueDataFeeds,
  removeUnsupportedRateDataFeeds,
  removeNonCryptoDataFeeds,
  addStableCoinVariants,
  addMarketCapRank,
  sortFeedsConfig,
} from './utils/common';
import { checkOnChainData } from './utils/on-chain';

export async function generateFeedConfig(
  rawDataFeeds: RawDataFeeds,
): Promise<NewFeedsConfig> {
  // Get the CL feeds on mainnet
  const mainnetDataFeeds: SimplifiedFeed[] =
    await getCLFeedsOnMainnet(rawDataFeeds);

  // Remove Pegged Assets Data Feeds

  // Get the unique data feeds
  const uniqueDataFeeds = getUniqueDataFeeds(mainnetDataFeeds);

  // Remove unsupported feed types
  const supportedCLFeeds = removeUnsupportedRateDataFeeds(uniqueDataFeeds);

  // Remove non-crypto feeds
  const supportedCLFeedsCrypto = removeNonCryptoDataFeeds(supportedCLFeeds);

  // Add stablecoin variants
  const dataFeedsWithStableCoinVariants = addStableCoinVariants(
    supportedCLFeedsCrypto,
  );

  // Add providers data to the feeds and filter out feeds without providers
  const dataFeedsWithCryptoResources = (
    await addDataProviders(dataFeedsWithStableCoinVariants)
  ).filter(
    dataFeed =>
      Object.keys(dataFeed.additional_feed_info.arguments).length !== 0,
  );

  await checkOnChainData(rawDataFeeds, dataFeedsWithCryptoResources);

  // Add market cap rank
  const dataFeedWithRank = await addMarketCapRank(dataFeedsWithCryptoResources);

  // Sort the feeds
  const feedsSorted = sortFeedsConfig(dataFeedWithRank);

  // Construct the final feeds config
  const feeds = feedsSorted.map((simplifiedFeed, id) => {
    const feed: NewFeed = {
      ...simplifiedFeed,
      id,
      type: 'price-feed',
      oracle_id: 'crypto-price-feeds',
      value_type: 'numerical',
      stride: 0,
      quorum: {
        percentage: 100,
        aggregation: 'median',
      },
      schedule: {
        interval_ms: 90000,
        heartbeat_ms: 3600000,
        deviation_percentage: 0.1,
        first_report_start_unix_time_ms: 0,
      },
    };
    return feed;
  });

  return { feeds: feeds };
}
