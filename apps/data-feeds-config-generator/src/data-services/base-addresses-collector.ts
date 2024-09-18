// import { ethers } from 'hardhat';
// import { Contract, Filter, Log } from 'ethers';
// import fs from 'fs/promises';
// import ABI1 from '../abis/ABI1.json';
// import ABI2 from '../abis/ABI2.json';
// import { HardhatEthersProvider } from '@nomicfoundation/hardhat-ethers/internal/hardhat-ethers-provider';

import { Web3, Contract, FMT_NUMBER, FMT_BYTES } from 'web3';

import {
  NetworkName,
  EthereumAddress,
  parseEthereumAddress,
} from '@blocksense/base-utils/evm-utils';

export const FeedRegistries: {
  [key in NetworkName]?: EthereumAddress;
} = {
  mainnet: parseEthereumAddress('0x47Fb2585D2C56Fe188D0E6ec628a38b74fCeeeDf'),
};

const feedRegistryEvents: {
  [key in NetworkName]?: {
    blockNumber: number;
    asset: EthereumAddress;
    denomination: EthereumAddress;
    latestAggregator: EthereumAddress;
    previousAggregator: EthereumAddress;
    aggregatorDescription: string;
  }[];
} = {
  mainnet: [],
};

export async function getAggregatorBaseAddress(
  web3: Web3,
  network: NetworkName,
  aggregatorProxy: EthereumAddress,
): Promise<EthereumAddress | null> {
  const registryAddress = FeedRegistries[network];
  if (!registryAddress) {
    throw new Error(`No feed registry found for network ${network}`);
  }

  let events = feedRegistryEvents[network];
  if (!events || events.length === 0) {
    console.log(
      `Fetching events for registry '${registryAddress}' (on network '${network}')`,
    );
    events = await fetchEvents(web3, registryAddress, 0, 0);
  } else {
    console.log(
      `Using cached ${events.length} events for registry '${registryAddress}' (on network '${network}')`,
    );
  }

  const event = events.find(
    event => event.latestAggregator === aggregatorProxy,
  );

  return event?.asset ?? null;
}

async function getAllProposedFeedsInRegistry(
  web3: Web3,
  feedRegistryAddress: EthereumAddress,
): Promise<EthereumAddress[]> {
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

  const proposedFeeds = await registryContract.getPastEvents(
    'FeedConfirmed',
    {
      fromBlock: 0,
      toBlock: 'latest',
    },
    {
      number: FMT_NUMBER.BIGINT,
      bytes: FMT_BYTES.HEX,
    },
  );

  const asd = proposedFeeds.filter(f => typeof f === 'object');

  return asd;
}

const fetchEvents = async (
  contractAddress: string,
  fromBlock: number,
  toBlock: number,
) => {
  const provider = ethers.provider;

  const contract = new Contract(contractAddress, ABI1, provider);

  const CHUNK_SIZE = 10_000;
  let logs: any[] = [];
  for (let block = fromBlock; block <= toBlock; block += CHUNK_SIZE) {
    const toBlockInChunk = Math.min(block + CHUNK_SIZE - 1, toBlock);
    const data = await getEvents(
      provider,
      contract,
      {
        FeedConfirmed: [
          'asset',
          'denomination',
          'latestAggregator',
          'previousAggregator',
        ],
      },
      block,
      toBlockInChunk,
    );

    logs = logs.concat(data);
  }

  return logs;
};

// get events from a contract in a given block range
const getEvents = async (
  provider: HardhatEthersProvider,
  contract: Contract,
  topicData: any,
  fromBlock: number,
  toBlock: number,
) => {
  const topics = await Promise.all(
    Object.keys(topicData).map(
      async eventName =>
        (await contract.filters[eventName]().getTopicFilter())[0],
    ),
  );

  const filter: Filter = {
    topics,
    address: await contract.getAddress(),
    fromBlock,
    toBlock,
  };

  const eventLogs = await provider.getLogs(filter);
  const events = eventLogs.map(async (log: Log) => {
    try {
      const parsedLog = contract.interface.parseLog(log)!;
      if (topics.includes(parsedLog.topic)) {
        const parsedLogData: any = {
          blockNumber: log.blockNumber,
        };
        topicData[parsedLog.name].forEach((field: string) => {
          parsedLogData[field] = parsedLog.args[field].toString();
        });
        if (parsedLogData.latestAggregator !== ethers.ZeroAddress) {
          const aggregator = new Contract(
            parsedLogData.latestAggregator,
            ABI2,
            provider,
          );
          parsedLogData.aggregatorDescription = await aggregator.description();
        } else if (parsedLogData.previousAggregator !== ethers.ZeroAddress) {
          const aggregator = new Contract(
            parsedLogData.previousAggregator,
            ABI2,
            provider,
          );
          parsedLogData.aggregatorDescription = await aggregator.description();
        }
        return {
          [parsedLog.name]: parsedLogData,
        };
      }
    } catch (error) {
      console.log('error');
      if (log?.topics[0] === topics[0]) {
        console.log('log', log);
      }
    }
    return '';
  });

  return Promise.all(events);
};

// example usage
(async () => {
  try {
    const contractAddress = '0x47Fb2585D2C56Fe188D0E6ec628a38b74fCeeeDf';
    const fromBlock = 12864088;
    const toBlock = 16293745;

    const data = await fetchEvents(contractAddress, fromBlock, toBlock);
    await fs.writeFile(
      process.cwd() + '/scripts/data.json',
      JSON.stringify(data, null, 2),
      'utf8',
    );

    process.exit(0);
  } catch (e: any) {
    console.log(e.message);
    process.exit(1);
  }
})();
