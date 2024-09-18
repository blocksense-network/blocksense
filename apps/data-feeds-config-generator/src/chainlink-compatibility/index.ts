import { selectDirectory } from '@blocksense/base-utils/fs';
import { parseEthereumAddress } from '@blocksense/base-utils/evm-utils';

import {
  denominationTokenToAddress,
  isDenominationToken,
  parseDenominationToken,
} from '@blocksense/config-types/chainlink-compatibility';

import {
  BlocksenseFeedsCompatibility,
  ChainlinkAggregatorProxy,
  ChainlinkCompatibilityData,
  chainlinkNetworkNameToChainId,
  parseNetworkName,
  ChainlinkAddressToBlocksenseId,
  ChainlinkCompatibilityConfig,
} from './types';
import { artifactsDir } from '../paths';
import { RawDataFeeds } from '../data-services/types';
import { FeedsConfig } from '@blocksense/config-types/data-feeds-config';

async function getBlocksenseFeedsCompatibility(
  rawDataFeeds: RawDataFeeds,
  feedConfig: FeedsConfig,
): Promise<BlocksenseFeedsCompatibility> {
  const blocksenseFeedsCompatibility = Object.entries(rawDataFeeds)
    .filter(([feedName, _]) => feedName.split(' / ')[1] === 'USD')
    .reduce((acc, [feedName, feedData]) => {
      // Transform each feed data
      const chainlinkProxies = Object.entries(feedData.networks).reduce(
        (proxiesAcc, [networkFile, perNetworkFeedData]) => {
          const networkName = parseNetworkName(networkFile);
          const chainId = chainlinkNetworkNameToChainId[networkName];
          if (chainId != null) {
            const address = perNetworkFeedData.proxyAddress
              ? parseEthereumAddress(perNetworkFeedData.proxyAddress)
              : null;
            proxiesAcc = {
              ...proxiesAcc,
              [chainId]: address,
            }; // Collect the proxy address for each network
          }
          return proxiesAcc;
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

      let chainlink_compatibility: ChainlinkCompatibilityData = {
        base: null,
        quote: denominationTokenToAddress.USD,
        chainlink_aggregator_proxies: chainlinkProxies,
      };

      if (isDenominationToken(feedName.split(' / ')[0])) {
        chainlink_compatibility = {
          base: denominationTokenToAddress[
            parseDenominationToken(feedName.split(' / ')[0])
          ],
          quote: denominationTokenToAddress.USD,
          chainlink_aggregator_proxies: chainlinkProxies,
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
        const { proxyAddress } = networkDetails;
        if (proxyAddress) {
          const correspondingBlocksenseFeed = feedConfig.feeds.find(
            feed => feed.description === feedName,
          );
          result = {
            ...result,
            // Note: The address might not be an Ethereum address
            [`${parseNetworkName(networkFile)}/${proxyAddress}`]:
              correspondingBlocksenseFeed
                ? correspondingBlocksenseFeed.id
                : null,
          };
        }
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
): Promise<ChainlinkCompatibilityConfig> {
  const blocksenseFeedsCompatibility = await getBlocksenseFeedsCompatibility(
    rawDataFeeds,
    feedConfig,
  );
  const chainlinkAddressToBlocksenseId =
    await getChainlinkAddressToBlocksenseId(rawDataFeeds, feedConfig);

  return {
    blocksenseFeedsCompatibility: blocksenseFeedsCompatibility,
    chainlinkAddressToBlocksenseId: chainlinkAddressToBlocksenseId,
  };
}
