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
} from '@blocksense/config-types/data-feeds-config';

import ChainLinkAbi from '@blocksense/contracts/abis/ChainlinkAggregatorProxy.json';

import { ChainLinkFeedInfo, RawDataFeeds } from '../data-services/types';
import { CMCInfo, getCMCCryptoList } from '../data-services/fetchers/cmc';
import { isFeedSupportedByYF } from '../data-services/fetchers/yf';
import { artifactsDir } from '../paths';
import {
  chainlinkNetworkNameToChainId,
  parseNetworkFilename,
} from '../chainlink-compatibility/types';

function getBaseQuote(data: ChainLinkFeedInfo) {
  if (data.docs && data.docs.baseAsset && data.docs.quoteAsset) {
    return { base: data.docs.baseAsset, quote: data.docs.quoteAsset };
  }
  if (data.pair.length === 2 && data.pair[0] && data.pair[1]) {
    return { base: data.pair[0], quote: data.pair[1] };
  }
  const [base, quote] = data.name.split(' / ');
  return { base, quote };
}

function feedFromChainLinkFeedInfo(
  data: ChainLinkFeedInfo,
): Omit<Feed, 'id' | 'script'> {
  return {
    name: data.name,
    fullName: data.assetName,
    description: data.name,
    type: data.feedType,
    decimals: data.decimals,
    pair: getBaseQuote(data),
    resources: {},
    report_interval_ms: 300_000,
    first_report_start_time: {
      secs_since_epoch: 0,
      nanos_since_epoch: 0,
    },
    quorum_percentage: 1,
  };
}
async function isFeedSupported(
  feed: {
    type: FeedType;
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
  feeds: Omit<Feed, 'id' | 'script'>[],
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

export async function generateFeedConfig(
  rawDataFeeds: RawDataFeeds,
): Promise<FeedsConfig> {
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
  function convertRawDataFeed(feedData: {
    networks: Record<string, ChainLinkFeedInfo>;
  }): Omit<Feed, 'id' | 'script'> | null {
    const validNetworks = filterMainnetNetworks(feedData.networks);
    const maxEntry = findMaxDecimalsNetwork(validNetworks);

    if (!maxEntry) {
      return null;
    }

    return { ...feedFromChainLinkFeedInfo(maxEntry) };
  }

  const dataFeedsOnMainnetWithMaxDecimals: Omit<Feed, 'id' | 'script'>[] =
    rawDataFeedsOnMainnets
      .map(([_feedName, feedData]) => convertRawDataFeed(feedData))
      .filter((feed): feed is Omit<Feed, 'id' | 'script'> => feed !== null); // Filter out null entries

  const supportedCMCCurrencies = await getCMCCryptoList();

  const usdPairFeeds = dataFeedsOnMainnetWithMaxDecimals.filter(
    feed => feed.pair.quote === 'USD',
  );

  const feeds = await filterAsync(usdPairFeeds, feed =>
    isFeedSupported(feed, supportedCMCCurrencies),
  );

  await checkOnChainData(rawDataFeedsOnMainnets, feeds);

  const feedsSortedByDescription = feeds.sort((a, b) => {
    // We hash the descriptions here, to avoid an obvious ordering.
    const a_ = keccak256(a.description).toString();
    const b_ = keccak256(b.description).toString();
    return a_.localeCompare(b_);
  });
  const feedsWithIdAndScript = feedsSortedByDescription.map((feed, id) => ({
    id,
    ...feed,
    script: decodeScript(
      'cmc_id' in feed.resources ? 'CoinMarketCap' : 'YahooFinance',
    ),
  }));

  {
    const { writeJSON } = selectDirectory(artifactsDir);
    await writeJSON({
      content: { feeds: feedsWithIdAndScript },
      name: 'feeds_config',
    });
  }

  return { feeds: feedsWithIdAndScript };
}
