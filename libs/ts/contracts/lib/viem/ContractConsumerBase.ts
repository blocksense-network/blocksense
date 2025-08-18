import {
  createPublicClient,
  http,
  type PublicClient,
  type Address,
  Chain,
} from 'viem';
import * as viemChains from 'viem/chains';

import {
  getRpcUrl,
  networkMetadata,
  NetworkName,
} from '@blocksense/base-utils/evm';

import { valuesOf } from '@blocksense/base-utils';

export abstract class ContractConsumerBase {
  public client: PublicClient;
  public contractAddress: Address;

  /**
   * Initializes the consumer client with a Viem PublicClient.
   *
   * @param contractAddress The address of the contract.
   * @param client The Viem PublicClient instance to use for interactions.
   */
  protected constructor(contractAddress: Address, client: PublicClient) {
    this.contractAddress = contractAddress;
    this.client = client;
  }

  /**
   * Creates an instance of a consumer for a specific network by its name.
   * This static method initializes a public client using the provided network name
   * and constructs a new consumer instance with the given contract address and client.
   *
   * @param contractAddress - The address of the contract associated with the consumer.
   * @param networkName - The name of the network to connect to.
   * @returns A new instance of the consumer configured for the specified network.
   */
  public static createConsumerByNetworkName<T extends ContractConsumerBase>(
    this: new (contractAddress: Address, client: PublicClient) => T,
    contractAddress: Address,
    networkName: NetworkName,
  ): T {
    const chain = getViemChain(networkName);
    const client = createPublicClient({
      chain: chain,
      transport: chain
        ? http(chain.rpcUrls.default.http[0])
        : http(getRpcUrl(networkName)),
    });
    return new this(contractAddress, client);
  }
  /**
   * Creates an instance of a consumer using a specific RPC URL.
   * This static method initializes a public client using the provided RPC URL
   * and constructs a new consumer instance with the given contract address and client.
   *
   * @param contractAddress - The address of the contract associated with the consumer.
   * @param rpcUrl - The RPC URL to connect to.
   * @returns A new instance of the consumer configured for the specified RPC URL.
   */
  public static createConsumerByRpcUrl<T extends ContractConsumerBase>(
    this: new (contractAddress: Address, client: PublicClient) => T,
    contractAddress: Address,
    rpcUrl: string,
  ): T {
    const client = createPublicClient({
      transport: http(rpcUrl),
    });
    return new this(contractAddress, client);
  }
}

// TODO:(EmilIvanichkovv): Consider moving this function to a more appropriate location, if necessary.
export function getViemChain(network: NetworkName): Chain | undefined {
  const id = networkMetadata[network].chainId;
  const chain = valuesOf(viemChains).find(chain => chain.id === id);
  if (!chain) {
    console.error(`Viem chain definition not found for network: ${network}`);
    return undefined;
  }
  return chain;
}
