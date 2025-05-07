import { NewFeedsConfig, NewFeed } from '@blocksense/config-types';

import { Artifacts } from '../../data-services/artifacts-downloader';
import { RawDataFeeds } from '../../data-services/fetchers/chainlink/types';
import { addDataProviders } from './data-providers';
import { SimplifiedFeed } from './types';
import {
  getCLFeedsOnMainnet,
  removeUnsupportedRateDataFeeds,
  chainLinkFileNameIsNotTestnet,
} from './utils/chainlink';
import {
  getUniqueDataFeeds,
  removeNonCryptoDataFeeds,
  addStableCoinVariants,
  addMarketCapRank,
  sortFeedsConfig,
} from './utils/common';
import { checkOnChainData } from './utils/on-chain';

export async function generateFeedConfig(
  rawDataFeeds: RawDataFeeds,
  artifacts: Artifacts,
): Promise<NewFeedsConfig> {
  // Get the CL feeds on mainnet
  const mainnetDataFeeds: SimplifiedFeed[] =
    await getCLFeedsOnMainnet(rawDataFeeds);

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
    await addDataProviders(
      dataFeedsWithStableCoinVariants,
      artifacts.exchangeAssets,
    )
  ).filter(
    dataFeed =>
      Object.keys(dataFeed.additional_feed_info.arguments).length !== 0,
  );

  let rawDataFeedsOnMainnets = Object.entries(rawDataFeeds).filter(
    ([_feedName, feedData]) =>
      // If the data feed is not present on any mainnet, we don't include it.
      Object.entries(feedData.networks).some(([chainlinkFileName, _feedData]) =>
        chainLinkFileNameIsNotTestnet(chainlinkFileName),
      ),
  );

  await checkOnChainData(rawDataFeedsOnMainnets, dataFeedsWithCryptoResources);

  // Add market cap rank
  const dataFeedWithRank = await addMarketCapRank(
    dataFeedsWithCryptoResources,
    artifacts.cmcMarketCap,
  );

  // Sort the feeds
  const feedsSorted = sortFeedsConfig(dataFeedWithRank);

  // Construct the final feeds config
  const feeds = feedsSorted.map((simplifiedFeed, id) => {
    const feed: NewFeed = {
      ...simplifiedFeed,
      id: BigInt(id),
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
