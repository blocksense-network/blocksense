import keccak256 from 'keccak256';
import Web3 from 'web3';

import { assertNotNull } from '@blocksense/base-utils/assert';
import { everyAsync, filterAsync } from '@blocksense/base-utils/async';
import { selectDirectory } from '@blocksense/base-utils/fs';
import {
  getRpcUrl,
  isTestnet,
  network,
  networkName,
  NetworkName,
} from '@blocksense/base-utils/evm';
import { isObject, KeysOf } from '@blocksense/base-utils/type-level';

import {
  Feed,
  FeedsConfig,
  FeedType,
  Pair,
  decodeScript,
  FeedCategory,
  NewFeed,
  NewFeedsConfig,
} from '@blocksense/config-types/data-feeds-config';

import ChainLinkAbi from '@blocksense/contracts/abis/ChainlinkAggregatorProxy.json';

import {
  ChainLinkFeedDocsInfo,
  ChainLinkFeedInfo,
  RawDataFeeds,
} from '../data-services/types';
import { artifactsDir } from '../paths';
import {
  chainlinkNetworkNameToChainId,
  parseNetworkFilename,
} from '../chainlink-compatibility/types';
import {
  AggregatedFeedInfo,
  aggregateNetworkInfoPerField,
  CookedDataFeeds,
  getFieldFromAggregatedData,
} from '../data-services/chainlink_feeds';
import { keysOf } from '@blocksense/base-utils/array-iter';
import { dataProvidersInjection } from './data-providers';
import { SimplifiedFeed } from './types';

function getBaseQuote(data: AggregatedFeedInfo) {
  const docsBaseQuote = getFieldFromAggregatedData(data, 'docs', 'baseAsset');
  const docsQuoteBase = getFieldFromAggregatedData(data, 'docs', 'quoteAsset');
  const pair = getFieldFromAggregatedData(data, 'pair');
  const name = getFieldFromAggregatedData(data, 'name');

  if (docsBaseQuote && docsQuoteBase) {
    return { base: docsBaseQuote, quote: docsQuoteBase };
  }
  if (pair && pair.length === 2 && pair[0] && pair[1]) {
    return { base: pair[0], quote: pair[1] };
  }
  if (name) {
    const [base, quote] = name.split(' / ');
    return { base, quote };
  }
  return { base: '', quote: '' };
}

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
  const decimals = !isObject(additionalData.decimals)
    ? additionalData.decimals
    : Object.values(additionalData.decimals).reduce(
        (max, value) => (value > max ? value : max),
        0,
      );

  return {
    description,
    fullName,
    priceFeedInfo: {
      pair: getBaseQuote(additionalData),
      decimals,
      category,
      marketHours,
      aggregation: '',
      providers: {},
    },
  };
}

function isDataFeedOnMainnet(
  networks: Record<string, ChainLinkFeedInfo>,
): boolean {
  return Object.keys(networks).some(chainLinkFileNameIsNotTestnet);
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
  const allPossibleDataFeeds = Object.entries(cookedDataFeeds)
    .map(([_feedName, feedData]) => {
      return {
        ...feedFromChainLinkFeedInfo(feedData),
      };
    })
    .filter((feed): feed is SimplifiedFeed => feed !== null); // Filter out null entries
  return allPossibleDataFeeds;
}

function getUniqueDataFeeds(dataFeeds: SimplifiedFeed[]): SimplifiedFeed[] {
  const seenPairs = new Set<string>();

  return dataFeeds.filter(feed => {
    const { base, quote } = feed.priceFeedInfo.pair;
    const pairKey = `${base}-${quote}`; // Create a unique key for the pair

    if (seenPairs.has(pairKey)) {
      return false; // Exclude if the pair is already in the set
    }

    seenPairs.add(pairKey); // Add the pair to the set
    return true; // Include in the result
  });
}

export async function getCLFeedsOnMainnet(
  rawDataFeeds: RawDataFeeds,
): Promise<SimplifiedFeed[]> {
  const onMainnetCookedDataFeeds = aggregateNetworkInfoPerField(
    rawDataFeeds,
    true,
  );
  const onMainnetDataFeeds = Object.entries(rawDataFeeds)
    .map(([feedName, feedData]) => {
      if (isDataFeedOnMainnet(feedData.networks)) {
        return {
          ...feedFromChainLinkFeedInfo(onMainnetCookedDataFeeds[feedName]),
        };
      } else {
        return null;
      }
    })
    .filter((feed): feed is SimplifiedFeed => feed !== null); // Filter out null entries
  console.log(onMainnetDataFeeds.length);
  return onMainnetDataFeeds;
}

export async function generateFeedConfig(
  rawDataFeeds: RawDataFeeds,
): Promise<NewFeedsConfig> {
  const mainnetDataFeeds: SimplifiedFeed[] =
    await getCLFeedsOnMainnet(rawDataFeeds);

  const uniqueDataFeeds = getUniqueDataFeeds(mainnetDataFeeds);

  {
    const { writeJSON } = selectDirectory(artifactsDir);
    await writeJSON({
      content: { feeds: uniqueDataFeeds },
      name: 'uniqueDataFeeds',
    });
  }

  function isEmpty(obj: object): boolean {
    return Object.keys(obj).length === 0;
  }

  const dataFeedsWithCryptoResources = (
    await dataProvidersInjection(uniqueDataFeeds)
  ).filter(dataFeed => !isEmpty(dataFeed.priceFeedInfo.providers));

  {
    const { writeJSON } = selectDirectory(artifactsDir);
    await writeJSON({
      content: { feeds: dataFeedsWithCryptoResources },
      name: 'dataFeedsWithCryptoResources',
    });
  }

  console.log('dataFeedsOnMainnetWithMaxDecimals', mainnetDataFeeds.length);
  console.log('uniqueDataFeeds', uniqueDataFeeds.length);
  console.log('uniqueDataFeeds', dataFeedsWithCryptoResources.length);

  let rawDataFeedsOnMainnets = Object.entries(rawDataFeeds).filter(
    ([_feedName, feedData]) =>
      // If the data feed is not present on any mainnet, we don't include it.
      Object.entries(feedData.networks).some(([chainlinkFileName, _feedData]) =>
        chainLinkFileNameIsNotTestnet(chainlinkFileName),
      ),
  );
  await checkOnChainData(rawDataFeedsOnMainnets, dataFeedsWithCryptoResources);

  const feedsSortedByDescription = dataFeedsWithCryptoResources.sort((a, b) => {
    // We hash the descriptions here, to avoid an obvious ordering.
    const a_ = keccak256(a.description).toString();
    const b_ = keccak256(b.description).toString();
    return a_.localeCompare(b_);
  });

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

  {
    const { writeJSON } = selectDirectory(artifactsDir);
    await writeJSON({
      content: { feeds: feeds },
      name: 'feeds_config',
    });
  }

  return { feeds: feeds };
}
