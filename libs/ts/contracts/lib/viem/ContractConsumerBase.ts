import { type PublicClient } from 'viem';

import { NetworkName, EthereumAddress } from '@blocksense/base-utils/evm';

import { createViemClient } from './create-client';

export abstract class ContractConsumerBase {
  public client: PublicClient;
  public contractAddress: EthereumAddress;

  /**
   * Initializes the consumer client with a Viem PublicClient.
   *
   * @param contractAddress The address of the contract.
   * @param client The Viem PublicClient instance to use for interactions.
   */
  protected constructor(
    contractAddress: EthereumAddress,
    client: PublicClient,
  ) {
    this.contractAddress = contractAddress;
    this.client = client;
  }

  public static create<T extends ContractConsumerBase>(
    this: new (contractAddress: EthereumAddress, client: PublicClient) => T,
    contractAddress: EthereumAddress,
    networkNameOrRpcUrl: NetworkName | string,
  ): T {
    const url = URL.canParse(networkNameOrRpcUrl)
      ? new URL(networkNameOrRpcUrl)
      : (networkNameOrRpcUrl as NetworkName);
    const client = createViemClient(url);
    return new this(contractAddress, client);
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
    this: new (contractAddress: EthereumAddress, client: PublicClient) => T,
    contractAddress: EthereumAddress,
    networkName: NetworkName,
  ): T {
    const client = createViemClient(networkName);
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
    this: new (contractAddress: EthereumAddress, client: PublicClient) => T,
    contractAddress: EthereumAddress,
    rpcUrl: string,
  ): T {
    const client = createViemClient(new URL(rpcUrl));
    return new this(contractAddress, client);
  }
}
