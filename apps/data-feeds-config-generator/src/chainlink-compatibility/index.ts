import { tuple, fromEntries } from '@blocksense/base-utils/array-iter';
import { selectDirectory } from '@blocksense/base-utils/fs';
import { parseEthereumAddress, zeroAddress } from '@blocksense/base-utils/evm';

import { NewFeedsConfig } from '@blocksense/config-types/data-feeds-config';
import {
  BlocksenseFeedsCompatibility,
  ChainlinkAddressToBlocksenseId,
  ChainlinkCompatibilityConfig,
  isSupportedCurrencySymbol,
  currencySymbolToDenominationAddress,
} from '@blocksense/config-types/chainlink-compatibility';

import { parseNetworkFilename, chainlinkNetworkNameToChainId } from './types';

import { artifactsDir } from '../paths';
import { RawDataFeeds } from '../data-services/fetchers/chainlink/types';
import { FeedRegistryEventsPerAggregator } from '../chainlink-compatibility/types';

async function getBlocksenseFeedsCompatibility(
  rawDataFeeds: RawDataFeeds,
  feedConfig: NewFeedsConfig,
  feedRegistryEvents: FeedRegistryEventsPerAggregator,
): Promise<BlocksenseFeedsCompatibility> {
  const blocksenseFeedsCompatibility = Object.entries(rawDataFeeds).reduce(
    (acc, [feedName, feedData]) => {
      const chainlinkAggregators = fromEntries(
        Object.entries(feedData.networks)
          .filter(
            ([networkFile, _perNetworkFeedData]) =>
              chainlinkNetworkNameToChainId[parseNetworkFilename(networkFile)],
          )
          .map(([networkFile, perNetworkFeedData]) => {
            const networkName =
              chainlinkNetworkNameToChainId[parseNetworkFilename(networkFile)];
            return tuple(
              networkName!,
              parseEthereumAddress(perNetworkFeedData.contractAddress),
            );
          }),
      );

      const dataFeed = feedConfig.feeds.find(feed => {
        if (!feed.additional_feed_info?.compatibility_info) {
          return false;
        }
        return (
          feed.additional_feed_info.compatibility_info.chainlink === feedName
        );
      });

      if (!dataFeed) {
        console.error(`[compatibility] Feed not found for '${feedName}'`);
        return acc; // Return the accumulator unchanged
      }
      const dataFeedId = dataFeed.id;

      const { base, quote } = dataFeed.additional_feed_info.pair;

      const baseAddress = isSupportedCurrencySymbol(base)
        ? currencySymbolToDenominationAddress[base]
        : (feedRegistryEvents[
            chainlinkAggregators['ethereum-mainnet'] ?? zeroAddress
          ]?.asset ?? null);

      const quoteAddress = isSupportedCurrencySymbol(quote)
        ? currencySymbolToDenominationAddress[quote]
        : (feedRegistryEvents[
            chainlinkAggregators['ethereum-mainnet'] ?? zeroAddress
          ]?.asset ?? null);

      acc = {
        ...acc,
        [dataFeedId]: {
          id: dataFeedId,
          description: feedName,
          chainlink_compatibility: {
            base: baseAddress,
            quote: quoteAddress,
            chainlink_aggregators: chainlinkAggregators,
          },
        },
      };

      return acc;
    },
    {} as BlocksenseFeedsCompatibility,
  );

  return blocksenseFeedsCompatibility;
}

async function getChainlinkAddressToBlocksenseId(
  rawDataFeeds: RawDataFeeds,
  feedConfig: NewFeedsConfig,
) {
  const chainlinkAddressToBlocksenseId = Object.entries(rawDataFeeds).reduce(
    (result, [feedName, feedDetails]) => {
      const { networks } = feedDetails;

      Object.entries(networks).forEach(([networkFile, networkDetails]) => {
        const { contractAddress } = networkDetails;
        const correspondingBlocksenseFeed = feedConfig.feeds.find(
          feed => feed.description === feedName,
        );
        result = {
          ...result,
          // Note: The address might not be an Ethereum address
          [`${parseNetworkFilename(networkFile)}/${contractAddress}`]:
            correspondingBlocksenseFeed ? correspondingBlocksenseFeed.id : null,
        };
      });

      return result;
    },
    {} as ChainlinkAddressToBlocksenseId,
  );

  return chainlinkAddressToBlocksenseId;
}

export async function generateChainlinkCompatibilityConfig(
  rawDataFeeds: RawDataFeeds,
  feedConfig: NewFeedsConfig,
  feedRegistryEvents: FeedRegistryEventsPerAggregator,
): Promise<ChainlinkCompatibilityConfig> {
  const blocksenseFeedsCompatibility = await getBlocksenseFeedsCompatibility(
    rawDataFeeds,
    feedConfig,
    feedRegistryEvents,
  );
  const chainlinkAddressToBlocksenseId =
    await getChainlinkAddressToBlocksenseId(rawDataFeeds, feedConfig);

  return {
    blocksenseFeedsCompatibility: blocksenseFeedsCompatibility,
    chainlinkAddressToBlocksenseId: chainlinkAddressToBlocksenseId,
  };
}
