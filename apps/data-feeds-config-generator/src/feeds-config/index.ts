import keccak256 from 'keccak256';
import Web3 from 'web3';

import { assertNotNull } from '@blocksense/base-utils/assert';
import { everyAsync } from '@blocksense/base-utils/async';
import { getRpcUrl, isTestnet, NetworkName } from '@blocksense/base-utils/evm';

import {
  NewFeed,
  NewFeedsConfig,
  createPair,
  pairToString,
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
import { addDataProviders, stableCoins } from './data-providers';

function feedFromChainLinkFeedInfo(
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

  const categoryFixup = {
    crypto: 'Crypto',
    'Fixed-Income': 'Fixed Income',
  };

  return {
    description,
    full_name,
    additional_feed_info: {
      pair: pair,
      decimals: getHighestDecimals(additionalData),
      category:
        category in categoryFixup
          ? categoryFixup[category as keyof typeof categoryFixup]
          : category,
      market_hours,
      arguments: {},
      compatibility_info: {
        chainlink: clName,
      },
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
    const pairKey = pairToString(feed.additional_feed_info.pair);

    if (seenPairs.has(pairKey)) {
      return false;
    }

    seenPairs.add(pairKey);
    return true;
  });
}

function addStableCoinVariants(feeds: SimplifiedFeed[]): SimplifiedFeed[] {
  const stableCoinVariants = feeds.flatMap(feed => {
    const { base, quote } = feed.additional_feed_info.pair;
    if (quote in stableCoins) {
      return stableCoins[quote as keyof typeof stableCoins]
        .map(altStableCoin => createPair(base, altStableCoin))
        .map(pair => {
          const full_name = pairToString(pair);
          return {
            ...feed,
            full_name,
            additional_feed_info: {
              ...structuredClone(feed.additional_feed_info),
              pair,
            },
          };
        });
    }
    return [];
  });

  return [...feeds, ...stableCoinVariants];
}

function removeUnsupportedRateDataFeeds(
  dataFeeds: SimplifiedFeed[],
): SimplifiedFeed[] {
  const unsupported = [
    'exchange rate',
    'exchange-rate',
    'calculated',
    'marketcap',
  ];

  return dataFeeds.filter(
    feed =>
      !unsupported.some(x =>
        feed.additional_feed_info.compatibility_info.chainlink
          .toLowerCase()
          .includes(x),
      ),
  );
}

function removeNonCryptoDataFeeds(
  dataFeeds: SimplifiedFeed[],
): SimplifiedFeed[] {
  return dataFeeds.filter(feed =>
    ['', 'Crypto'].some(x => x == feed.additional_feed_info.category),
  );
}

export async function generateFeedConfig(
  rawDataFeeds: RawDataFeeds,
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
    await addDataProviders(dataFeedsWithStableCoinVariants)
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
