import keccak256 from 'keccak256';
import Web3 from 'web3';

import { assertNotNull } from '@blocksense/base-utils/assert';
import { everyAsync } from '@blocksense/base-utils/async';
import { getRpcUrl, isTestnet, NetworkName } from '@blocksense/base-utils/evm';

import {
  NewFeed,
  NewFeedsConfig,
} from '@blocksense/config-types/data-feeds-config';

import ChainLinkAbi from '@blocksense/contracts/abis/ChainlinkAggregatorProxy.json';

import { ChainLinkFeedInfo, RawDataFeeds } from '../data-services/types';
import {
  chainlinkNetworkNameToChainId,
  parseNetworkFilename,
} from '../chainlink-compatibility/types';
import {
  AggregatedFeedInfo,
  aggregateNetworkInfoPerField,
  CookedDataFeeds,
  getBaseQuote,
  getFieldFromAggregatedData,
  getHighestDecimals,
} from '../data-services/chainlink_feeds';
import { SimplifiedFeed } from './types';
import { dataProvidersInjection } from './data-providers';

function feedFromChainLinkFeedInfo(
  additionalData: AggregatedFeedInfo,
): SimplifiedFeed {
  const description = getFieldFromAggregatedData(additionalData, 'assetName');
  const fullName = getFieldFromAggregatedData(additionalData, 'name');
  const category = getFieldFromAggregatedData(additionalData, 'feedType');
  const marketHours = getFieldFromAggregatedData(
    additionalData,
    'docs',
    'marketHours',
  );

  return {
    description,
    fullName,
    priceFeedInfo: {
      pair: getBaseQuote(additionalData),
      decimals: getHighestDecimals(additionalData),
      category,
      marketHours,
      aggregation: 'fixme',
      providers: {},
    },
  };
}

function chainLinkFileNameIsNotTestnet(fileName: string) {
  const chainlinkNetworkName = parseNetworkFilename(fileName);
  const networkName = chainlinkNetworkNameToChainId[chainlinkNetworkName];
  if (networkName == null) return false;
  return !isTestnet(networkName);
}

async function isFeedDataSameOnChain(
  networkName: NetworkName,
  feedInfo: ChainLinkFeedInfo,
  web3: Web3 = new Web3(getRpcUrl(networkName)),
): Promise<boolean> {
  const chainLinkContractAddress = feedInfo.contractAddress;

  const chainLinkContract = new web3.eth.Contract(
    ChainLinkAbi,
    chainLinkContractAddress,
  );

  try {
    const [decimals, description] = (await Promise.all([
      chainLinkContract.methods['decimals']().call(),
      chainLinkContract.methods['description']().call(),
    ])) as unknown as [number, string];

    return (
      BigInt(decimals) === BigInt(feedInfo.decimals) &&
      description === feedInfo.name
    );
  } catch (e) {
    console.error(
      `Failed to fetch data from ${networkName} for ${feedInfo.name} at ${chainLinkContractAddress}`,
    );

    // If we can't fetch the data, we assume it's correct.
    return true;
  }
}

async function checkOnChainData(
  rawDataFeedsOnMainnets: any[],
  feeds: SimplifiedFeed[],
) {
  let flatedNonTestnetSupportedFeeds = rawDataFeedsOnMainnets
    .filter(([feedName, _feedData]) =>
      feeds.some(feed => feed.description === feedName),
    )
    .flatMap(([_feedName, feedData]) => {
      return Object.entries(feedData.networks).map(
        ([chaninLinkFileName, feedData]) => ({
          network:
            chainlinkNetworkNameToChainId[
              parseNetworkFilename(chaninLinkFileName)
            ],
          feed: feedData,
        }),
      );
    })
    .filter(x => x.network && !isTestnet(x.network));

  if (
    !(await everyAsync(flatedNonTestnetSupportedFeeds, x =>
      isFeedDataSameOnChain(
        assertNotNull(x.network),
        x.feed as ChainLinkFeedInfo,
      ),
    ))
  ) {
    throw new Error("Feed data doesn't match on chain");
  }
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
    .map(([feedName, _feedData]) => {
      return {
        ...feedFromChainLinkFeedInfo(onMainnetCookedDataFeeds[feedName]),
      };
    });

  return onMainnetDataFeeds;
}

function isDataFeedOnMainnet(
  networks: Record<string, ChainLinkFeedInfo>,
): boolean {
  return Object.keys(networks).some(chainLinkFileNameIsNotTestnet);
}

function getUniqueDataFeeds(dataFeeds: SimplifiedFeed[]): SimplifiedFeed[] {
  const seenPairs = new Set<string>();

  return dataFeeds.filter(feed => {
    const pairKey = feed.priceFeedInfo.pair.toString();

    if (seenPairs.has(pairKey)) {
      return false;
    }

    seenPairs.add(pairKey);
    return true;
  });
}

export async function generateFeedConfig(
  rawDataFeeds: RawDataFeeds,
): Promise<NewFeedsConfig> {
  // Get the CL feeds on mainnet
  const mainnetDataFeeds: SimplifiedFeed[] =
    await getCLFeedsOnMainnet(rawDataFeeds);

  // Get the unique data feeds
  const uniqueDataFeeds = getUniqueDataFeeds(mainnetDataFeeds);

  // Add providers data to the feeds and filter out feeds without providers
  const dataFeedsWithCryptoResources = (
    await dataProvidersInjection(uniqueDataFeeds)
  ).filter(
    dataFeed => Object.keys(dataFeed.priceFeedInfo.providers).length !== 0,
  );

  let rawDataFeedsOnMainnets = Object.entries(rawDataFeeds).filter(
    ([_feedName, feedData]) =>
      // If the data feed is not present on any mainnet, we don't include it.
      Object.entries(feedData.networks).some(([chainlinkFileName, _feedData]) =>
        chainLinkFileNameIsNotTestnet(chainlinkFileName),
      ),
  );

  await checkOnChainData(rawDataFeedsOnMainnets, dataFeedsWithCryptoResources);

  // Sort the feeds by description
  const feedsSortedByDescription = dataFeedsWithCryptoResources.sort((a, b) => {
    // We hash the descriptions here, to avoid an obvious ordering.
    const a_ = keccak256(a.description).toString();
    const b_ = keccak256(b.description).toString();
    return a_.localeCompare(b_);
  });

  // Construct the final feeds config
  const feeds = feedsSortedByDescription.map((simplifiedFeed, id) => {
    const feed: NewFeed = {
      ...simplifiedFeed,
      id,
      type: 'price-feed',
      valueType: 'Numerical',
      consensusAggregation: 'Median',
      quorumPercentage: 100,
      deviationPercentage: 0,
      skipPublishIfLessThanPercentage: 0.1,
      alwaysPublishHeartbeatMs: 3600000,
    };
    return feed;
  });

  return { feeds: feeds };
}
