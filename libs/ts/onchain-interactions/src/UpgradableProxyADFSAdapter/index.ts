import {
  Chain,
  createPublicClient,
  getContract,
  http,
  type PublicClient,
} from 'viem';
import { Hex } from 'viem';
import { encodePacked } from 'viem';
import * as viemChains from 'viem/chains';
import { abi as UpgradableProxyADFSAbi } from './abi';

import {
  getRpcUrl,
  networkMetadata,
  NetworkName,
} from '@blocksense/base-utils/evm';
import { valuesOf } from '@blocksense/base-utils/array-iter';

export class AggregatedDataFeedStore {
  public contract;
  public client: PublicClient;
  private selectors: Record<string, `0x${string}`> = {
    getLatestIndex: '0x81',
    getLatestSingleData: '0x82',
    getLatestSingleDataAndIndex: '0x83',
    getLatestData: '0x84',
    getLatestDataAndIndex: '0x85',
    getFeedAtIndex: '0x86',
  };

  constructor(
    public contractAddress: `0x${string}`,
    networkName: NetworkName,
  ) {
    this.client = createPublicClient({
      chain: getViemChain(networkName),
      transport: http(getRpcUrl(networkName)),
    });

    console.log(getRpcUrl(networkName));

    this.contract = getContract({
      address: contractAddress,
      abi: UpgradableProxyADFSAbi,
      client: this.client,
    });
  }

  private async call(encodedParams: Hex): Promise<`0x${string}`> {
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

  private splitInto32bChunks(value: `0x${string}`): `0x${string}`[] {
    const regex = new RegExp(`(.{1,${64}})`, 'g');
    return value
      .slice(2)
      .split(regex)
      .filter(chunk => chunk.length > 0)
      .map(chunk => ('0x' + chunk) as `0x${string}`);
  }

  async getLatestSingleData(feedId: bigint): Promise<`0x${string}`> {
    const encoded = encodePacked(
      ['bytes1', 'uint128'],
      [this.selectors['getLatestSingleData'], feedId],
    );
    return await this.call(encoded);
  }

  async getLatestData(feedId: bigint): Promise<`0x${string}`[]> {
    const encoded = encodePacked(
      ['bytes1', 'uint128'],
      [this.selectors['getLatestData'], feedId],
    );
    const res = await this.call(encoded);
    return this.splitInto32bChunks(res);
  }

  async getLatestDataSlice(
    feedId: bigint,
    startSlot: number,
    slots: number = 0,
  ): Promise<`0x${string}`[]> {
    const encoded = encodePacked(
      ['bytes1', 'uint128', 'uint32', 'uint32'],
      [this.selectors['getLatestData'], feedId, startSlot, slots],
    );
    const res = await this.call(encoded);
    return this.splitInto32bChunks(res);
  }

  async getSingleDataAtIndex(
    feedId: bigint,
    index: number,
  ): Promise<`0x${string}`> {
    const encoded = encodePacked(
      ['bytes1', 'uint128', 'uint16'],
      [this.selectors['getFeedAtIndex'], feedId, index],
    );
    return await this.call(encoded);
  }

  async getDataAtIndex(
    feedId: bigint,
    index: number,
  ): Promise<`0x${string}`[]> {
    const encoded = encodePacked(
      ['bytes1', 'uint128', 'uint16'],
      [this.selectors['getFeedAtIndex'], feedId, index],
    );
    const res = await this.call(encoded);
    return this.splitInto32bChunks(res);
  }

  async getDataSliceAtIndex(
    feedId: bigint,
    index: number,
    startSlot: number,
    slots: number = 0,
  ): Promise<`0x${string}`[]> {
    const encoded = encodePacked(
      ['bytes1', 'uint128', 'uint16', 'uint32', 'uint32'],
      [this.selectors['getFeedAtIndex'], feedId, index, startSlot, slots],
    );
    const res = await this.call(encoded);
    return this.splitInto32bChunks(res);
  }

  async getLatestIndex(feedId: bigint): Promise<Number> {
    const encoded = encodePacked(
      ['bytes1', 'uint128'],
      [this.selectors['getLatestIndex'], feedId],
    );
    const res = await this.call(encoded);
    const value = Number(res);

    return value;
  }

  async getLatestSingleDataAndIndex(feedId: bigint): Promise<IndexAndData> {
    const encoded = encodePacked(
      ['bytes1', 'uint128'],
      [this.selectors['getLatestSingleDataAndIndex'], feedId],
    );
    const res = await this.call(encoded);
    const index = Number(res.slice(0, 66));
    const data = `0x${res.slice(66)}` as `0x${string}`;

    return { index, data };
  }

  async getLatestDataAndIndex(feedId: bigint): Promise<IndexAndData> {
    const encoded = encodePacked(
      ['bytes1', 'uint128'],
      [this.selectors['getLatestDataAndIndex'], feedId],
    );
    const res = await this.call(encoded);
    const index = Number(res.slice(0, 66));
    const data = this.splitInto32bChunks(`0x${res.slice(66)}`);

    return { index, data };
  }

  async getLatestDataSliceAndIndex(
    feedId: bigint,
    startSlot: number,
    slots: number = 0,
  ): Promise<IndexAndData> {
    const encoded = encodePacked(
      ['bytes1', 'uint128', 'uint32', 'uint32'],
      [this.selectors['getLatestDataAndIndex'], feedId, startSlot, slots],
    );
    const res = await this.call(encoded);
    const index = Number(res.slice(0, 66));
    const data = this.splitInto32bChunks(`0x${res.slice(66)}`);

    return { index, data };
  }
}

type IndexAndData = { index: number; data: `0x${string}` | `0x${string}`[] };

function getViemChain(network: NetworkName): Chain | undefined {
  const id = networkMetadata[network].chainId;
  const chain = valuesOf(viemChains).find(chain => chain.id === id);
  if (!chain) {
    console.error(`Viem chain definition not found for network: ${network}`);
    return undefined;
  }
  return chain;
}

const adfs = new AggregatedDataFeedStore(
  '0xADF5aacfA254FbC566d3b81e04b95db4bCF7b40F',
  'base-sepolia',
);
// Single value
const value = await adfs.getLatestSingleData(731n);
console.log(`single data: ${value}`);

// Latest data
const value2 = await adfs.getLatestData(731n);
console.log(value2);

// Latest index
const latestIndex = await adfs.getLatestIndex(0n);
console.log(`Latest index for feed 0: ${latestIndex}`);

// Latest single data and index
const latestSingleDataAndIndex = await adfs.getLatestSingleDataAndIndex(0n);
console.log(latestSingleDataAndIndex);

// Single data at index
const singleDataAtIndex = await adfs.getSingleDataAtIndex(0n, 7);
console.log(singleDataAtIndex);

// Data at index
const dataAtIndex = await adfs.getDataAtIndex(1n, 7);
console.log(dataAtIndex);

// Data slice at index
const dataSliceAtIndex = await adfs.getDataSliceAtIndex(0n, 7, 0);
console.log(dataSliceAtIndex);

// Latest data slice
const latestDataAndIndex = await adfs.getLatestDataAndIndex(0n);
console.log(latestDataAndIndex);

// Latest data slice and index
const latestDataSliceAndIndex = await adfs.getLatestDataSliceAndIndex(0n, 0, 0);
console.log(latestDataSliceAndIndex);
