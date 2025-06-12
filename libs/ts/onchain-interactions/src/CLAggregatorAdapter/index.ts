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
  public client: PublicClient;

  constructor(
    public contractAddress: `0x${string}`,
    networkName: NetworkName,
  ) {
    this.client = createPublicClient({
      chain: getViemChain(networkName),
      transport: http(getRpcUrl(networkName)),
    });

    this.contract = getContract({
      address: contractAddress,
      abi: clAdapterAbi,
      client: this.client,
    });
  }

  async decimals() {
    return await this.contract.read.decimals();
  }

  async dataFeedStore() {
    return await this.contract.read.dataFeedStore();
  }

  async description() {
    return await this.contract.read.description();
  }

  async id() {
    return await this.contract.read.id();
  }

  async latestAnswer() {
    return await this.contract.read.latestAnswer();
  }

  async latestRound() {
    return await this.contract.read.latestRound();
  }

  async latestRoundData() {
    return await this.contract.read.latestRoundData();
  }

  async getRoundData(roundId: bigint) {
    return await this.contract.read.getRoundData([roundId]);
  }

  async getCLAggregatorAdapterData() {
    return await this.client.multicall({
      contracts: clAdapterAbi
        .filter(method => method.type === 'function')
        .filter(method => method.name !== 'getRoundData')
        .map(method => ({
          address: this.contractAddress,
          abi: clAdapterAbi,
          functionName: method.name,
        })),
    });
  }
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
