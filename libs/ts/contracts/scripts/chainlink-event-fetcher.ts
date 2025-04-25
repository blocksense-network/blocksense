import { ethers } from 'hardhat';
import { Contract, Filter, Log } from 'ethers';

import AggregatorProxyABI from '../abis/ChainlinkAggregatorProxy.json';
import OffchainAggregatorABI from '../abis/ChainlinkOffchainAggregator.json';
import { HardhatEthersProvider } from '@nomicfoundation/hardhat-ethers/internal/hardhat-ethers-provider';

// fetch the latest event in the last 10k blocks
const fetchLatestEvent = async (proxyAddress: string): Promise<any> => {
  const provider = ethers.provider;

  const offchainAggregator = await getAggregatorContract(
    proxyAddress,
    provider,
  );

  const latestBlock = await provider.getBlockNumber();

  return (
    await getEvents(
      provider,
      offchainAggregator,
      {
        NewTransmission: ['answer', 'observations'],
      },
      latestBlock - 10000,
      latestBlock,
    )
  ).slice(-1);
};

// fetch events in a given block range for a given Chainlink proxy contract
const fetchEvents = async (
  proxyAddress: string,
  fromBlock: number,
  toBlock: number,
): Promise<any> => {
  const provider = ethers.provider;

  const offchainAggregator = await getAggregatorContract(
    proxyAddress,
    provider,
  );

  const logs = await getEvents(
    provider,
    offchainAggregator,
    {
      NewTransmission: ['answer', 'observations'],
    },
    fromBlock,
    toBlock,
  );

  return {
    decimals: await offchainAggregator.decimals(),
    logs,
  };
};

// get the Chainlink aggregator contract from the proxy contract
const getAggregatorContract = async (
  proxyAddress: string,
  provider: HardhatEthersProvider,
): Promise<Contract> => {
  const signer = await provider.getSigner();
  const proxyAggregator = new Contract(
    proxyAddress,
    AggregatorProxyABI,
    signer,
  );

  return new Contract(
    await proxyAggregator.aggregator(),
    OffchainAggregatorABI,
    signer,
  );
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

  const events = eventLogs.map((log: Log) => {
    try {
      const parsedLog = contract.interface.parseLog(log)!;
      if (topics.includes(parsedLog.topic)) {
        const parsedLogData: any = {
          blockNumber: log.blockNumber,
        };
        topicData[parsedLog.name].forEach((field: string) => {
          parsedLogData[field] = parsedLog.args[field].toString();
        });
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

  return events;
};

// example usage
(async () => {
  try {
    // AAVE / USD AggregatorProxy
    const proxyAddress = '0x547a514d5e3769680Ce22B2361c10Ea13619e8a9';
    const fromBlock = 19489514;
    const toBlock = 19490617;

    const data = await fetchEvents(proxyAddress, fromBlock, toBlock);
    console.log('decimals:', data.decimals);
    data.logs.map((log: any) => {
      console.log(log);
    });
    console.log(
      'latest event in the last 10k blocks:',
      await fetchLatestEvent(proxyAddress),
    );

    process.exit(0);
  } catch (e: any) {
    console.log(e.message);
    process.exit(1);
  }
})();
