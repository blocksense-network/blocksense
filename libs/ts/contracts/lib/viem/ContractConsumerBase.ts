import { type PublicClient } from 'viem';

import { NetworkName, EthereumAddress } from '@blocksense/base-utils/evm';

import { createViemClient } from './create-client';

export abstract class ContractConsumerBase {
  /**
   * Initializes the consumer client with a Viem PublicClient.
   *
   * @param contractAddress The address of the contract.
   * @param client The Viem PublicClient instance to use for interactions.
   */
  protected constructor(
    public readonly contractAddress: EthereumAddress,
    public readonly client: PublicClient,
  ) {}

  /**
   * Creates a new instance of the concrete consumer bound to a specific
   * contract address and network (or explicit RPC URL).
   *
   * Internally this uses createViemClient to instantiate a Viem PublicClient
   * which is then passed to the subclass constructor.
   *
   * @example
   * const consumer = MyConsumer.create('0xabc...', 'ethereum-mainnet');
   *
   * @typeParam T - The concrete subtype of ContractConsumerBase being
   * instantiated.
   * @param contractAddress - The EVM address of the target smart contract.
   * @param networkNameOrRpcUrl - A supported network name or a full RPC URL.
   * @returns A new, ready-to-use instance of the invoking subclass.
   */
  public static create<T extends ContractConsumerBase>(
    this: new (contractAddress: EthereumAddress, client: PublicClient) => T,
    contractAddress: EthereumAddress,
    networkNameOrRpcUrl: NetworkName | URL,
  ): T {
    const client = createViemClient(networkNameOrRpcUrl);
    return new this(contractAddress, client);
  }
}
