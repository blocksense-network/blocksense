import { getContract, PublicClient, Address } from 'viem';

import { ContractConsumerBase } from './ContractConsumerBase';
import { abi as clAdapterAbi } from '../abis/CLAggregatorAdapter';

export class CLAggregatorAdapterConsumer extends ContractConsumerBase {
  public contract;

  /**
   * Constructs a CLAggregatorAdapterConsumer.
   *
   * @param contractAddress The address of the CLAggregatorAdapter contract.
   * @param client The Viem PublicClient instance to use.
   */
  constructor(contractAddress: Address, client: PublicClient) {
    super(contractAddress, client);

    this.contract = getContract({
      address: this.contractAddress,
      abi: clAdapterAbi,
      client: this.client,
    });
  }

  async getDecimals(): Promise<number> {
    return this.contract.read.decimals();
  }

  async getDataFeedStore(): Promise<Address> {
    return this.contract.read.dataFeedStore();
  }

  async getDescription(): Promise<string> {
    return this.contract.read.description();
  }

  async getId(): Promise<bigint> {
    return this.contract.read.id();
  }

  async getLatestAnswer(): Promise<bigint> {
    return this.contract.read.latestAnswer();
  }

  async getLatestRound(): Promise<bigint> {
    return this.contract.read.latestRound();
  }

  async getLatestRoundData(): Promise<RoundData> {
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
      dataFeedStore: results[0].result as Address,
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
  dataFeedStore: Address;
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
