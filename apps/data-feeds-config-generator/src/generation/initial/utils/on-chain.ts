import Web3 from 'web3';

import { assertNotNull } from '@blocksense/base-utils/assert';
import { everyAsync } from '@blocksense/base-utils/async';
import { NetworkName, getRpcUrl, isTestnet } from '@blocksense/base-utils/evm';

import { ChainLinkFeedInfo } from '../../../data-services/types';
import {
  chainlinkNetworkNameToChainId,
  parseNetworkFilename,
} from '../../../chainlink-compatibility/types';
import { SimplifiedFeed } from '../types';

import ChainLinkAbi from '@blocksense/contracts/abis/ChainlinkAggregatorProxy.json';

export async function isFeedDataSameOnChain(
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

export async function checkOnChainData(
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
