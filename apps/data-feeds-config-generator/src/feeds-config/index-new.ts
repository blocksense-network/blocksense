import keccak256 from 'keccak256';
import Web3 from 'web3';

import { assertNotNull } from '@blocksense/base-utils/assert';
import { everyAsync, filterAsync } from '@blocksense/base-utils/async';
import { selectDirectory } from '@blocksense/base-utils/fs';
import { getRpcUrl, isTestnet, NetworkName } from '@blocksense/base-utils/evm';

import {
  Feed,
  FeedsConfig,
  FeedType,
  Pair,
  decodeScript,
  NewFeed,
  FeedCategory,
} from '@blocksense/config-types/data-feeds-config';

import ChainLinkAbi from '@blocksense/contracts/abis/ChainlinkAggregatorProxy.json';

import { ChainLinkFeedInfo, RawDataFeeds } from '../data-services/types';
import { fetchCMCCryptoList } from '../data-services/fetchers/cmc';
import { isFeedSupportedByYF } from '../data-services/fetchers/yf';
import { artifactsDir } from '../paths';
import {
  chainlinkNetworkNameToChainId,
  parseNetworkFilename,
} from '../chainlink-compatibility/types';
import { dataProvidersInjection } from './data-providers';

function feedFromChainLinkFeedInfo_New(
  data: ChainLinkFeedInfo,
): Omit<NewFeed, 'id'> {
  const dataPair = data.pair;
  const [base, quote] = data.name.split(' / ');

  const pair =
    dataPair[0] !== '' && dataPair[1] !== ''
      ? { base: dataPair[0], quote: dataPair[1] }
      : { base, quote };

  return {
    type: 'price-feed',
    description: data.name,
    quorumThreshold: 1,
    priceFeedInfo: {
      pair,
      decimals: data.decimals,
      category: data.feedType,
      marketHours: data.docs.marketHours,
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

export async function generateFeedConfig(
  rawDataFeeds: RawDataFeeds,
): Promise<void> {
  // Filter out the data feeds that are not present on any mainnet.
  let rawDataFeedsOnMainnets = Object.entries(rawDataFeeds).filter(
    ([_feedName, feedData]) =>
      // If the data feed is not present on any mainnet, we don't include it.
      Object.entries(feedData.networks).some(([chainlinkFileName, _feedData]) =>
        chainLinkFileNameIsNotTestnet(chainlinkFileName),
      ),
  );

  /**
   * Filters out testnet entries from the list of network files.
   */
  function filterMainnetNetworks(
    networks: Record<string, ChainLinkFeedInfo>,
  ): [string, ChainLinkFeedInfo][] {
    return Object.entries(networks).filter(([chainlinkFileName]) =>
      chainLinkFileNameIsNotTestnet(chainlinkFileName),
    );
  }

  /**
   * Finds the network entry with the highest decimals value.
   */
  function findMaxDecimalsNetwork(
    validNetworks: [string, ChainLinkFeedInfo][],
  ): ChainLinkFeedInfo | undefined {
    return validNetworks.reduce<ChainLinkFeedInfo | undefined>(
      (max, [, data]) => (!max || data.decimals > max.decimals ? data : max),
      undefined,
    );
  }

  /**
   * Processes a single raw data feed entry to extract and convert the
   *  "best" feed data to Feed structure.
   */
  function convertRawDataFeed_New(feedData: {
    networks: Record<string, ChainLinkFeedInfo>;
  }): Omit<NewFeed, 'id' | 'script'> | null {
    const validNetworks = filterMainnetNetworks(feedData.networks);
    const maxEntry = findMaxDecimalsNetwork(validNetworks);

    if (!maxEntry) {
      return null;
    }

    return { ...feedFromChainLinkFeedInfo_New(maxEntry) };
  }

  const dataFeedsOnMainnetWithMaxDecimals: Omit<NewFeed, 'id' | 'script'>[] =
    rawDataFeedsOnMainnets
      .map(([_feedName, feedData]) => convertRawDataFeed_New(feedData))
      .filter((feed): feed is Omit<NewFeed, 'id' | 'script'> => feed !== null);

  const dataFeedsOnMainnetWithMaxDecimals_New: Omit<
    NewFeed,
    'id' | 'script'
  >[] = rawDataFeedsOnMainnets
    .map(([_feedName, feedData]) => convertRawDataFeed_New(feedData))
    .filter((feed): feed is Omit<NewFeed, 'id' | 'script'> => feed !== null);

  {
    const { writeJSON } = selectDirectory(artifactsDir);
    await writeJSON({
      content: { allPossibleFeeds: dataFeedsOnMainnetWithMaxDecimals_New },
      name: 'allPossibleFeeds',
    });
  }

  const dataFeedsWithCryptoResources = await dataProvidersInjection(
    dataFeedsOnMainnetWithMaxDecimals_New,
  );

  {
    const { writeJSON } = selectDirectory(artifactsDir);
    await writeJSON({
      content: { dataFeedsWithCryptoResources },
      name: 'dataFeedsWithCryptoResources',
    });
  }

  // const feedsSortedByDescription = feeds.sort((a, b) => {
  //   // We hash the descriptions here, to avoid an obvious ordering.
  //   const a_ = keccak256(a.description).toString();
  //   const b_ = keccak256(b.description).toString();
  //   return a_.localeCompare(b_);
  // });
  // const feedsWithIdAndScript = feedsSortedByDescription.map((feed, id) => ({
  //   id,
  //   ...feed,
  //   script: decodeScript(
  //     'cmc_id' in feed.resources ? 'CoinMarketCap' : 'YahooFinance',
  //   ),
  // }));

  // {
  //   const { writeJSON } = selectDirectory(artifactsDir);
  //   await writeJSON({
  //     content: { feeds: feedsWithIdAndScript },
  //     name: 'feeds_config',
  //   });
  // }

  // return { feeds: feedsWithIdAndScript };
}
