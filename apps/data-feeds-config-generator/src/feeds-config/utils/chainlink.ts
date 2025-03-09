import { isTestnet } from '@blocksense/base-utils/evm';
import { pairToString } from '@blocksense/config-types';
import {
  parseNetworkFilename,
  chainlinkNetworkNameToChainId,
} from '../../chainlink-compatibility/types';
import {
  AggregatedFeedInfo,
  getFieldFromAggregatedData,
  getBaseQuote,
  getHighestDecimals,
  CookedDataFeeds,
  aggregateNetworkInfoPerField,
} from '../../data-services/chainlink_feeds';
import { RawDataFeeds, ChainLinkFeedInfo } from '../../data-services/types';
import { SimplifiedFeed } from '../types';

export function feedFromChainLinkFeedInfo(
  additionalData: AggregatedFeedInfo,
): SimplifiedFeed {
  const description = getFieldFromAggregatedData(additionalData, 'assetName');
  const category = getFieldFromAggregatedData(additionalData, 'feedType');
  const market_hours = getFieldFromAggregatedData(
    additionalData,
    'docs',
    'marketHours',
  );
  const clName = getFieldFromAggregatedData(additionalData, 'name');

  const pair = getBaseQuote(additionalData);
  const full_name = pairToString(pair);

  return {
    description,
    full_name,
    additional_feed_info: {
      pair: pair,
      decimals: getHighestDecimals(additionalData),
      category,
      market_hours,
      arguments: {},
      compatibility_info: {
        chainlink: clName,
      },
    },
  };
}

export function chainLinkFileNameIsNotTestnet(fileName: string) {
  const chainlinkNetworkName = parseNetworkFilename(fileName);
  const networkName = chainlinkNetworkNameToChainId[chainlinkNetworkName];
  if (networkName == null) return false;
  return !isTestnet(networkName);
}

export async function getAllPossibleCLFeeds(
  cookedDataFeeds: CookedDataFeeds,
): Promise<SimplifiedFeed[]> {
  const allPossibleDataFeeds = Object.entries(cookedDataFeeds).map(
    ([_feedName, feedData]) => {
      return {
        ...feedFromChainLinkFeedInfo(feedData),
      };
    },
  );

  return allPossibleDataFeeds;
}

export async function getCLFeedsOnMainnet(
  rawDataFeeds: RawDataFeeds,
): Promise<SimplifiedFeed[]> {
  const onMainnetCookedDataFeeds = aggregateNetworkInfoPerField(
    rawDataFeeds,
    true,
  );
  const onMainnetDataFeeds = Object.entries(rawDataFeeds)
    .filter(([_feedName, feedData]) => isDataFeedOnMainnet(feedData.networks))
    // Remove Pegged Assets Data Feeds
    .filter(
      ([_feedName, feedData]) => !isPeggedAssetDataFeed(feedData.networks),
    )
    // Remove CL feeds with hidden docs
    .filter(([_feedName, feedData]) => !isHiddenDataFeed(feedData.networks))
    .map(([feedName, _feedData]) => {
      return {
        ...feedFromChainLinkFeedInfo(onMainnetCookedDataFeeds[feedName]),
      };
    });

  return onMainnetDataFeeds;
}

export function isDataFeedOnMainnet(
  networks: Record<string, ChainLinkFeedInfo>,
): boolean {
  return Object.keys(networks).some(chainLinkFileNameIsNotTestnet);
}

export function isPeggedAssetDataFeed(
  networks: Record<string, ChainLinkFeedInfo>,
) {
  return Object.values(networks).some(
    feedData => feedData.docs.assetSubClass == 'Pegged Asset',
  );
}

export function isHiddenDataFeed(networks: Record<string, ChainLinkFeedInfo>) {
  return Object.values(networks).every(
    feedData => feedData.docs.hidden === true,
  );
}
