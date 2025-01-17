import keccak256 from 'keccak256';
import Web3 from 'web3';

import { assertNotNull } from '@blocksense/base-utils/assert';
import { everyAsync } from '@blocksense/base-utils/async';
import { selectDirectory } from '@blocksense/base-utils/fs';
import { getRpcUrl, isTestnet, NetworkName } from '@blocksense/base-utils/evm';
import { isObject } from '@blocksense/base-utils/type-level';

import {
  Pair,
  FeedCategory,
  NewFeed,
  NewFeedsConfig,
  createPair,
} from '@blocksense/config-types/data-feeds-config';

import ChainLinkAbi from '@blocksense/contracts/abis/ChainlinkAggregatorProxy.json';

import { ChainLinkFeedInfo, RawDataFeeds } from '../data-services/types';
import { CMCInfo } from '../data-services/fetchers/aggregators/cmc';
import { isFeedSupportedByYF } from '../data-services/fetchers/markets/yf';
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
import { SimplifiedFeed } from './types';
import { dataProvidersInjection } from './data-providers';

function getBaseQuote(data: AggregatedFeedInfo): Pair {
  const docsBase = getFieldFromAggregatedData(data, 'docs', 'baseAsset');
  const docsQuote = getFieldFromAggregatedData(data, 'docs', 'quoteAsset');
  const pair = getFieldFromAggregatedData(data, 'pair');
  const name = getFieldFromAggregatedData(data, 'name');

  if (docsBase && docsQuote) {
    return createPair(docsBase, docsQuote);
  }
  if (pair && pair.length === 2 && pair[0] && pair[1]) {
    return createPair(pair[0], pair[1]);
  }
  if (name) {
    const [base, quote] = name.split(' / ');
    return createPair(base, quote);
  }
  return createPair('', '');
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
      aggregation: 'fixme',
      providers: {},
    },
  };
}

async function isFeedSupported(
  feed: {
    type: FeedCategory;
    pair: Pair;
    description: string;
    fullName: string;
    resources: any;
  },
  supportedCMCCurrencies: readonly CMCInfo[],
): Promise<boolean> {
  const cmcSupported = supportedCMCCurrencies.find(
    currency =>
      currency.symbol === feed.pair.base &&
      (feed.type === 'Crypto' || feed.type === ''),
  );
  if (cmcSupported != null) {
    feed.resources.cmc_id = cmcSupported.id;
    feed.resources.cmc_quote = feed.pair.base;
    feed.type = 'Crypto';
    return true;
  }

  const yfSupported = await isFeedSupportedByYF(feed.pair.base);
  if (yfSupported) {
    feed.resources.yf_symbol = feed.pair.base;
    if (
      feed.type === 'Currency' ||
      feed.type === 'Forex' ||
      feed.type === 'Fiat' ||
      feed.type === ''
    ) {
      feed.resources.yf_symbol = `${feed.pair.base}${feed.pair.quote}=X`;
    }

    const specialCases: Record<string, any> = {
      XAG: {
        yf_symbol: 'GC=F',
      },
      XAU: {
        yf_symbol: 'SI-F',
      },
    };

    const special = specialCases[feed.pair.base];
    if (special) feed.resources = { ...special };
    return true;
  }

  return false;
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
