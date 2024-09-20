import { Web3, FMT_NUMBER, FMT_BYTES } from 'web3';

import { selectDirectory } from '@blocksense/base-utils/fs';

import {
  NetworkName,
  EthereumAddress,
  parseEthereumAddress,
  isZeroAddress,
} from '@blocksense/base-utils/evm-utils';

import {
  ConfirmedFeedEvent,
  decodeConfirmedFeedEvent,
} from '../chainlink-compatibility/types';
import { RawDataFeeds, decodeChainLinkFeedsInfo } from './types';

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

export const feedRegistries: {
  [key in NetworkName]?: EthereumAddress;
} = {
  'ethereum-mainnet': parseEthereumAddress(
    '0x47Fb2585D2C56Fe188D0E6ec628a38b74fCeeeDf',
  ),
};

export type FeedRegistryEventsPerAggregator = {
  [aggregator: EthereumAddress]: ConfirmedFeedEvent['returnValues'];
};

export async function getAllProposedFeedsInRegistry(
  web3: Web3,
  network: NetworkName,
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
    await registryContract.getPastEvents(
      'FeedConfirmed',
      {
        fromBlock: 0,
        toBlock: 'latest',
      },
      {
        number: FMT_NUMBER.BIGINT,
        bytes: FMT_BYTES.HEX,
      },
    )
  )
    .map(f => decodeConfirmedFeedEvent(f).returnValues)
    .filter(ev => !isZeroAddress(ev.latestAggregator))
    .map(ev => [ev.latestAggregator, ev]);

  return Object.fromEntries(proposedFeeds);
}
