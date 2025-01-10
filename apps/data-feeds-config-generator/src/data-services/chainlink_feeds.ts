import { Web3 } from 'web3';

import { assertIsObject } from '@blocksense/base-utils/assert';
import { selectDirectory } from '@blocksense/base-utils/fs';
import { getRpcUrl, isTestnet } from '@blocksense/base-utils/evm';

import {
  NetworkName,
  EthereumAddress,
  parseEthereumAddress,
  isZeroAddress,
} from '@blocksense/base-utils/evm';

import {
  chainlinkNetworkNameToChainId,
  decodeConfirmedFeedEvent,
  FeedRegistryEventsPerAggregator,
  parseNetworkFilename,
} from '../chainlink-compatibility/types';
import { RawDataFeeds, decodeChainLinkFeedsInfo } from './types';
import { keysOf } from '@blocksense/base-utils/array-iter';

export async function collectRawDataFeeds(directoryPath: string) {
  const { readAllJSONFiles } = selectDirectory(directoryPath);

  const rawDataFeeds: RawDataFeeds = {};

  for (const { base, content } of await readAllJSONFiles()) {
    const info = decodeChainLinkFeedsInfo(content);

    for (const feed of info) {
      const feedName = feed.name;
      rawDataFeeds[feedName] ??= { networks: {} };
      if (rawDataFeeds[feedName].networks[base]) {
        console.error(`Duplicate feed for '${feedName}' on network '${base}'`);
      }
      rawDataFeeds[feedName].networks[base] = feed;
    }
  }

  return rawDataFeeds;
}

type FeedData = RawDataFeeds[string]['networks'][string];
type FeedDataFieldName = keyof FeedData;

export type AggregatedFeedInfo = {
  [F in FeedDataFieldName]: {
    [networkName in Exclude<NetworkName, 'local'>]: FeedData[F];
  };
};

export type CookedDataFeeds = {
  [feedName: string]: AggregatedFeedInfo;
};

export function aggregateNetworkInfoPerField(
  rawDataFeeds: RawDataFeeds,
  skipTestnetNetworks = false,
): CookedDataFeeds {
  const cookedDataFeeds: CookedDataFeeds = {};

  for (const feedName of Object.keys(rawDataFeeds)) {
    const feedData = rawDataFeeds[feedName].networks;

    const firstFeedData = feedData[keysOf(feedData)[0]];
    const fieldNames = keysOf(firstFeedData);

    const aggregatedFeedInfo: AggregatedFeedInfo = {} as AggregatedFeedInfo;

    for (const fieldName of fieldNames) {
      for (const chainlinkNetworkFilename of keysOf(feedData)) {
        const chainlinkNetworkName = parseNetworkFilename(
          chainlinkNetworkFilename,
        );

        const networkName = chainlinkNetworkNameToChainId[chainlinkNetworkName];
        if (!networkName || (skipTestnetNetworks && isTestnet(networkName))) {
          // `Skipping feed '${feedName}' on network '${chainlinkNetworkName}'`,
          continue;
        }

        const perNetworkFeedData = feedData[chainlinkNetworkFilename];
        const fieldValue = perNetworkFeedData[fieldName];
        aggregatedFeedInfo[fieldName] ??= {} as any;
        aggregatedFeedInfo[fieldName][networkName] = fieldValue;
      }

      if (!aggregatedFeedInfo[fieldName]) {
        // `Skipping field '${fieldName}' for feed '${feedName}' because it has no values`,
        continue;
      }

      const values = new Set(Object.values(aggregatedFeedInfo[fieldName]));
      if (values.size == 1) {
        aggregatedFeedInfo[fieldName] = values.values().next().value;
      }
    }

    cookedDataFeeds[feedName] = aggregatedFeedInfo;
  }

  return cookedDataFeeds;
}

export const feedRegistries: {
  [key in NetworkName]?: EthereumAddress;
} = {
  'ethereum-mainnet': parseEthereumAddress(
    '0x47Fb2585D2C56Fe188D0E6ec628a38b74fCeeeDf',
  ),
};

export async function getAllProposedFeedsInRegistry(
  network: NetworkName,
  web3: Web3 = new Web3(getRpcUrl(network)),
): Promise<FeedRegistryEventsPerAggregator> {
  const registryAddress = feedRegistries[network];
  if (!registryAddress) {
    throw new Error(`No feed registry found for network ${network}`);
  }
  return await getAllProposedFeedsRegistryEvents(web3, registryAddress);
}

export async function getAllProposedFeedsRegistryEvents(
  web3: Web3,
  feedRegistryAddress: EthereumAddress,
): Promise<FeedRegistryEventsPerAggregator> {
  const abi = [
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: 'address',
          name: 'asset',
          type: 'address',
        },
        {
          indexed: true,
          internalType: 'address',
          name: 'denomination',
          type: 'address',
        },
        {
          indexed: true,
          internalType: 'address',
          name: 'latestAggregator',
          type: 'address',
        },
        {
          indexed: false,
          internalType: 'address',
          name: 'previousAggregator',
          type: 'address',
        },
        {
          indexed: false,
          internalType: 'uint16',
          name: 'nextPhaseId',
          type: 'uint16',
        },
        {
          indexed: false,
          internalType: 'address',
          name: 'sender',
          type: 'address',
        },
      ],
      name: 'FeedConfirmed',
      type: 'event',
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: 'address',
          name: 'asset',
          type: 'address',
        },
        {
          indexed: true,
          internalType: 'address',
          name: 'denomination',
          type: 'address',
        },
        {
          indexed: true,
          internalType: 'address',
          name: 'proposedAggregator',
          type: 'address',
        },
        {
          indexed: false,
          internalType: 'address',
          name: 'currentAggregator',
          type: 'address',
        },
        {
          indexed: false,
          internalType: 'address',
          name: 'sender',
          type: 'address',
        },
      ],
      name: 'FeedProposed',
      type: 'event',
    },
  ] as const;

  const registryContract = new web3.eth.Contract(abi, feedRegistryAddress);

  const proposedFeeds = (
    await registryContract.getPastEvents('FeedConfirmed', {
      fromBlock: 0,
      toBlock: 'latest',
    })
  )
    .map(f => decodeConfirmedFeedEvent(assertIsObject(f).returnValues))
    .filter(ev => !isZeroAddress(ev.latestAggregator))
    .map(ev => [ev.latestAggregator, ev]);

  return Object.fromEntries(proposedFeeds);
}
