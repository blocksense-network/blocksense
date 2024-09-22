import { selectDirectory } from '@blocksense/base-utils/fs';
import {
  parseEthereumAddress,
  zeroAddress,
} from '@blocksense/base-utils/evm-utils';

import {
  BlocksenseFeedsCompatibility,
  ChainlinkAddressToBlocksenseId,
  ChainlinkAggregatorProxy,
  ChainlinkCompatibilityConfig,
  ChainlinkCompatibilityData,
  currencySymbolToDenominationAddress,
  isKnownDenominationSymbol,
} from '@blocksense/config-types/chainlink-compatibility';

import { parseNetworkFilename } from '../chainlink-compatibility/types';
import { artifactsDir } from '../paths';
import { RawDataFeeds } from '../data-services/types';
import { FeedsConfig } from '@blocksense/config-types/data-feeds-config';
import { FeedRegistryEventsPerAggregator } from '../data-services/chainlink_feeds';
import { chainlinkNetworkNameToChainId } from './types';
import assert from 'assert';

async function getBlocksenseFeedsCompatibility(
  rawDataFeeds: RawDataFeeds,
  feedConfig: FeedsConfig,
  feedRegistryEvents: FeedRegistryEventsPerAggregator,
): Promise<BlocksenseFeedsCompatibility> {
  const blocksenseFeedsCompatibility = Object.entries(rawDataFeeds)
    .filter(([feedName, _]) => feedName.split(' / ')[1] === 'USD')
    .reduce((acc, [feedName, feedData]) => {
      // Transform each feed data
      const chainlinkAggregators = Object.entries(feedData.networks).reduce(
        (proxiesAcc, [networkFile, perNetworkFeedData]) => {
          const chainId =
            chainlinkNetworkNameToChainId[parseNetworkFilename(networkFile)];
          if (chainId == null) return proxiesAcc; // Skip if the chainId is not found
          const address = parseEthereumAddress(
            perNetworkFeedData.contractAddress,
          );
          return {
            ...proxiesAcc,
            [chainId]: address,
          }; // Collect the proxy address for each network
        },
        {} as ChainlinkAggregatorProxy,
      );

      const dataFeed = feedConfig.feeds.find(
        feed => feed.description === feedName,
      );
      if (!dataFeed) {
        console.error(`Feed not found for '${feedName}'`);
        return acc; // Return the accumulator unchanged
      }
      const dataFeedId = dataFeed.id;

      const [base, quote] = feedName.split(' / ');
      assert(
        isKnownDenominationSymbol(quote),
        `Unknown quote symbol: ${quote}`,
      );

      let chainlink_compatibility: ChainlinkCompatibilityData = {
        base:
          feedRegistryEvents[chainlinkAggregators['1'] ?? zeroAddress]?.asset ??
          null,
        quote: currencySymbolToDenominationAddress[quote],
        chainlink_aggregators: chainlinkAggregators,
      };

      if (isKnownDenominationSymbol(base)) {
        chainlink_compatibility = {
          base: currencySymbolToDenominationAddress[base],
          quote: currencySymbolToDenominationAddress.USD,
          chainlink_aggregators: chainlinkAggregators,
        };
      }
      acc = {
        ...acc,
        [dataFeedId]: {
          id: dataFeedId,
          description: feedName,
          chainlink_compatibility,
        },
      };

      return acc;
    }, {} as BlocksenseFeedsCompatibility);

  {
    const { writeJSON } = selectDirectory(artifactsDir);
    await writeJSON({
      content: { blocksenseFeedsCompatibility: blocksenseFeedsCompatibility },
      name: 'blocksense_feeds_compatibility',
    });
  }

  return blocksenseFeedsCompatibility;
}

async function getChainlinkAddressToBlocksenseId(
  rawDataFeeds: RawDataFeeds,
  feedConfig: FeedsConfig,
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

  {
    const { writeJSON } = selectDirectory(artifactsDir);
    await writeJSON({
      content: {
        chainlinkAddressToBlocksenseId: chainlinkAddressToBlocksenseId,
      },
      name: 'chainlink_address_to_blocksense_id',
    });
  }

  return chainlinkAddressToBlocksenseId;
}

export async function generateChainlinkCompatibilityConfig(
  rawDataFeeds: RawDataFeeds,
  feedConfig: FeedsConfig,
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
