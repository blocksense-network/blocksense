import { PublicClient, Hex, encodePacked } from 'viem';
import { ContractConsumerBase } from './ContractConsumerBase';
import { EthereumAddress } from '@blocksense/base-utils/evm';

type DataAndIndex = { data: Hex | Hex[]; index: number };

export class AggregatedDataFeedStoreConsumer extends ContractConsumerBase {
  private selectors = {
    getLatestIndex: '0x81',
    getLatestSingleData: '0x82',
    getLatestSingleDataAndIndex: '0x83',
    getLatestData: '0x84',
    getLatestDataAndIndex: '0x85',
    getFeedAtIndex: '0x86',
  } as const;

  /**
   * Constructs a AggregatedDataFeedStoreConsumer.
   *
   * @param contractAddress The address of the UpgradeableProxyADFS contract.
   * @param client The Viem PublicClient instance to use.
   */
  constructor(contractAddress: EthereumAddress, client: PublicClient) {
    super(contractAddress, client);
  }

  private async call(encodedParams: Hex): Promise<Hex> {
    const { data: returnData } = await this.client.call({
      to: this.contractAddress,
      data: encodedParams,
    });

    if (!returnData) {
      throw new Error(
        'No data returned from the contract call with data: ' + encodedParams,
      );
    }
    return returnData;
  }

  async getLatestSingleData(feedId: bigint): Promise<Hex> {
    const encoded = encodePacked(
      ['bytes1', 'uint128'],
      [this.selectors.getLatestSingleData, feedId],
    );
    return await this.call(encoded);
  }

  async getLatestData(feedId: bigint): Promise<Hex[]> {
    const encoded = encodePacked(
      ['bytes1', 'uint128'],
      [this.selectors.getLatestData, feedId],
    );
    const res = await this.call(encoded);
    return this.splitInto32bChunks(res);
  }

  async getLatestDataSlice(
    feedId: bigint,
    startSlot: number,
    slots: number = 0,
  ): Promise<Hex[]> {
    const encoded = encodePacked(
      ['bytes1', 'uint128', 'uint32', 'uint32'],
      [this.selectors.getLatestData, feedId, startSlot, slots],
    );
    const res = await this.call(encoded);
    return this.splitInto32bChunks(res);
  }

  async getSingleDataAtIndex(feedId: bigint, index: number): Promise<Hex> {
    const encoded = encodePacked(
      ['bytes1', 'uint128', 'uint16'],
      [this.selectors.getFeedAtIndex, feedId, index],
    );
    return await this.call(encoded);
  }

  async getDataAtIndex(feedId: bigint, index: number): Promise<Hex[]> {
    const encoded = encodePacked(
      ['bytes1', 'uint128', 'uint16'],
      [this.selectors.getFeedAtIndex, feedId, index],
    );
    const res = await this.call(encoded);
    return this.splitInto32bChunks(res);
  }

  async getDataSliceAtIndex(
    feedId: bigint,
    index: number,
    startSlot: number,
    slots: number = 0,
  ): Promise<Hex[]> {
    const encoded = encodePacked(
      ['bytes1', 'uint128', 'uint16', 'uint32', 'uint32'],
      [this.selectors.getFeedAtIndex, feedId, index, startSlot, slots],
    );
    const res = await this.call(encoded);
    return this.splitInto32bChunks(res);
  }

  async getLatestIndex(feedId: bigint): Promise<Number> {
    const encoded = encodePacked(
      ['bytes1', 'uint128'],
      [this.selectors.getLatestIndex, feedId],
    );
    return Number(await this.call(encoded));
  }

  async getLatestSingleDataAndIndex(feedId: bigint): Promise<DataAndIndex> {
    const encoded = encodePacked(
      ['bytes1', 'uint128'],
      [this.selectors.getLatestSingleDataAndIndex, feedId],
    );
    const res = await this.call(encoded);
    const index = Number(res.slice(0, 66));
    const data = `0x${res.slice(66)}` as Hex;

    return { data, index };
  }

  async getLatestDataAndIndex(feedId: bigint): Promise<DataAndIndex> {
    const encoded = encodePacked(
      ['bytes1', 'uint128'],
      [this.selectors.getLatestDataAndIndex, feedId],
    );
    const res = await this.call(encoded);
    const index = Number(res.slice(0, 66));
    const data = this.splitInto32bChunks(`0x${res.slice(66)}`);

    return { data, index };
  }

  async getLatestDataSliceAndIndex(
    feedId: bigint,
    startSlot: number,
    slots: number = 0,
  ): Promise<DataAndIndex> {
    const encoded = encodePacked(
      ['bytes1', 'uint128', 'uint32', 'uint32'],
      [this.selectors.getLatestDataAndIndex, feedId, startSlot, slots],
    );
    const res = await this.call(encoded);
    const index = Number(res.slice(0, 66));
    const data = this.splitInto32bChunks(`0x${res.slice(66)}`);

    return { data, index };
  }

  private splitInto32bChunks(value: Hex): Hex[] {
    const regex = new RegExp(`(.{1,${64}})`, 'g');
    return value
      .slice(2)
      .split(regex)
      .filter(chunk => chunk.length > 0)
      .map(chunk => ('0x' + chunk) as Hex);
  }
}
