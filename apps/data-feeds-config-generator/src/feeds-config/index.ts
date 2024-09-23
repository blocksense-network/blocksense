import keccak256 from 'keccak256';
import Web3 from 'web3';

import { assertNotNull } from '@blocksense/base-utils/assert';
import { everyAsync, filterAsync } from '@blocksense/base-utils/async';
import { selectDirectory } from '@blocksense/base-utils/fs';
import {
  getRpcUrl,
  isTestnet,
  NetworkName,
} from '@blocksense/base-utils/evm-utils';

import {
  Feed,
  FeedsConfig,
  FeedType,
  Pair,
  decodeScript,
} from '@blocksense/config-types/data-feeds-config';

import ChainLinkAbi from '@blocksense/contracts/abis/ChainlinkAggregatorProxy.json';

import {
  ChainLinkFeedInfo,
  RawDataFeeds,
  CMCInfo,
} from '../data-services/types';
import { getCMCCryptoList } from '../data-services/cmc';
import { isFeedSupportedByYF } from '../data-services/yf';
import { artifactsDir } from '../paths';
import {
  chainlinkNetworkNameToChainId,
  parseNetworkFilename,
} from '../chainlink-compatibility/types';

function feedFromChainLinkFeedInfo(
  data: ChainLinkFeedInfo,
): Omit<Feed, 'id' | 'script'> {
  const [base, quote] = data.name.split(' / ');
  return {
    name: base,
    fullName: data.assetName,
    description: data.name,
    type: data.feedType,
    decimals: data.decimals,
    pair: { base, quote },
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

export async function generateFeedConfig(
  rawDataFeeds: RawDataFeeds,
): Promise<FeedsConfig> {
  let filteredFeeds = Object.entries(rawDataFeeds).filter(
    ([_feedName, feedData]) =>
      Object.entries(feedData.networks).some(([chainlinkFileName, _feedData]) =>
        chainLinkFileNameIsNotTestnet(chainlinkFileName),
      ),
  );

  const allPossibleFeeds: Omit<Feed, 'id' | 'script'>[] = filteredFeeds.map(
    ([_feedName, feedData]) => {
      const maxEntry = Object.entries(feedData.networks).reduce<
        ChainLinkFeedInfo | undefined
      >((max, [chainlinkFileName, data]) => {
        if (!chainLinkFileNameIsNotTestnet(chainlinkFileName)) return max;
        return !max || data.decimals > max.decimals ? data : max;
      }, undefined);

      return { ...feedFromChainLinkFeedInfo(maxEntry!) };
    },
  );

  const supportedCMCCurrencies = await getCMCCryptoList();

  const usdPairFeeds = allPossibleFeeds.filter(
    feed => feed.pair.quote === 'USD',
  );

  const feeds = await filterAsync(usdPairFeeds, feed =>
    isFeedSupported(feed, supportedCMCCurrencies),
  );

  let flatedNonTestnetSupportedFeeds = filteredFeeds
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
      isFeedDataSameOnChain(assertNotNull(x.network), x.feed),
    ))
  ) {
    throw new Error("Feed data doesn't match on chain");
  }

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
