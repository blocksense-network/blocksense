import {
  Chain,
  createPublicClient,
  getContract,
  http,
  type PublicClient,
} from 'viem';
import * as viemChains from 'viem/chains';

import {
  getRpcUrl,
  networkMetadata,
  NetworkName,
} from '@blocksense/base-utils/evm';
import { valuesOf } from '@blocksense/base-utils/array-iter';

import { abi as clAdapterAbi } from './abi';

export class CLAggregatorAdapter {
  public contract;

  constructor(
    public contractAddress: `0x${string}`,
    public readonly client: PublicClient,
  ) {
    this.contract = getContract({
      address: contractAddress,
      abi: clAdapterAbi,
      client: this.client,
    });
  }

  static getClientWithDefaultRpc(
    contractAddress: `0x${string}`,
    networkName: NetworkName,
  ) {
    return new CLAggregatorAdapter(
      contractAddress,
      createPublicClient({
        chain: getViemChain(networkName),
        transport: http(getRpcUrl(networkName)),
      }),
    );
  }
  static getClient(contractAddress: `0x${string}`, rpcUrl: string) {
    return new CLAggregatorAdapter(
      contractAddress,
      createPublicClient({
        transport: http(rpcUrl),
      }),
    );
  }

  async decimals(): Promise<number> {
    return await this.contract.read.decimals();
  }

  async dataFeedStore(): Promise<`0x${string}`> {
    return await this.contract.read.dataFeedStore();
  }

  async description(): Promise<string> {
    return await this.contract.read.description();
  }

  async id(): Promise<bigint> {
    return await this.contract.read.id();
  }

  async latestAnswer(): Promise<bigint> {
    return await this.contract.read.latestAnswer();
  }

  async latestRound(): Promise<bigint> {
    return await this.contract.read.latestRound();
  }

  async latestRoundData(): Promise<RoundData> {
    const roundDataResult = await this.contract.read.latestRoundData();
    return parseRoundData(roundDataResult);
  }

  async getRoundData(roundId: bigint): Promise<RoundData> {
    const roundDataResult = await this.contract.read.getRoundData([roundId]);
    return parseRoundData(roundDataResult);
  }

  async getCLAggregatorAdapterData(): Promise<CLAggregatorAdapterData> {
    const methods = clAdapterAbi
      .filter(method => method.type === 'function')
      .filter(method => method.name !== 'getRoundData')
      .map(method => ({
        address: this.contractAddress,
        abi: clAdapterAbi,
        functionName: method.name,
      }));
    const results = (
      await this.client.multicall({
        contracts: methods,
      })
    ).map((result, index) => {
      if (result.status === 'failure') {
        throw new Error(
          `Multicall for CLAggregatorAdapter failed for method: ${methods[index].functionName}. Error: ${result.error}`,
        );
      }
      return result;
    });
    return {
      dataFeedStore: results[0].result as `0x${string}`,
      decimals: results[1].result as number,
      description: results[2].result as string,
      id: results[3].result as bigint,
      latestAnswer: results[4].result as bigint,
      latestRound: results[5].result as bigint,
      latestRoundData: parseRoundData(
        results[6].result as readonly [bigint, bigint, bigint, bigint, bigint],
      ),
    };
  }
}

export type RoundData = {
  roundId: bigint;
  answer: bigint;
  startedAt: bigint;
  updatedAt: bigint;
  answeredInRound: bigint;
};

export type CLAggregatorAdapterData = {
  id: bigint;
  decimals: number;
  description: string;
  dataFeedStore: `0x${string}`;
  latestAnswer: bigint;
  latestRound: bigint;
  latestRoundData: RoundData;
};

function parseRoundData(
  roundData: readonly [bigint, bigint, bigint, bigint, bigint],
): RoundData {
  return {
    roundId: roundData[0],
    answer: roundData[1],
    startedAt: roundData[2],
    updatedAt: roundData[3],
    answeredInRound: roundData[4],
  };
}

function getViemChain(network: NetworkName): Chain | undefined {
  const id = networkMetadata[network].chainId;
  const chain = valuesOf(viemChains).find(chain => chain.id === id);
  if (!chain) {
    console.error(`Viem chain definition not found for network: ${network}`);
    return undefined;
  }
  return chain;
}
