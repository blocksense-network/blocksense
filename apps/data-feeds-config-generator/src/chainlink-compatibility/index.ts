import { tuple, fromEntries } from '@blocksense/base-utils/array-iter';
import { assert } from '@blocksense/base-utils/assert';
import { selectDirectory } from '@blocksense/base-utils/fs';
import {
  parseEthereumAddress,
  zeroAddress,
} from '@blocksense/base-utils/evm-utils';

import { FeedsConfig } from '@blocksense/config-types/data-feeds-config';
import {
  BlocksenseFeedsCompatibility,
  ChainlinkAddressToBlocksenseId,
  ChainlinkCompatibilityConfig,
  isSupportedCurrencySymbol,
  currencySymbolToDenominationAddress,
} from '@blocksense/config-types/chainlink-compatibility';

import { parseNetworkFilename, chainlinkNetworkNameToChainId } from './types';

import { artifactsDir } from '../paths';
import { RawDataFeeds } from '../data-services/types';
import { FeedRegistryEventsPerAggregator } from '../chainlink-compatibility/types';

async function getBlocksenseFeedsCompatibility(
  rawDataFeeds: RawDataFeeds,
  feedConfig: FeedsConfig,
  feedRegistryEvents: FeedRegistryEventsPerAggregator,
): Promise<BlocksenseFeedsCompatibility> {
  const blocksenseFeedsCompatibility = Object.entries(rawDataFeeds)
    .filter(([feedName, _]) => feedName.split(' / ')[1] === 'USD')
    .reduce((acc, [feedName, feedData]) => {
      const chainlinkAggregators = fromEntries(
        Object.entries(feedData.networks)
          .map(([networkFile, perNetworkFeedData]) => {
            const networkName =
              chainlinkNetworkNameToChainId[parseNetworkFilename(networkFile)];
            return networkName == null
              ? null
              : tuple(
                  networkName,
                  parseEthereumAddress(perNetworkFeedData.contractAddress),
                );
          })
          .filter(pair => pair != null),
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
        isSupportedCurrencySymbol(quote),
        `Unknown quote symbol: ${quote}`,
      );

      const baseAddress = isSupportedCurrencySymbol(base)
        ? currencySymbolToDenominationAddress[base]
        : feedRegistryEvents[
            chainlinkAggregators['ethereum-mainnet'] ?? zeroAddress
          ]?.asset ?? null;

      acc = {
        ...acc,
        [dataFeedId]: {
          id: dataFeedId,
          description: feedName,
          chainlink_compatibility: {
            base: baseAddress,
            quote: currencySymbolToDenominationAddress[quote],
            chainlink_aggregators: chainlinkAggregators,
          },
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
