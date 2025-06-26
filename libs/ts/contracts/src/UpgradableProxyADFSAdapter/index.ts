import {
  Chain,
  createPublicClient,
  getContract,
  http,
  type PublicClient,
  Hex,
  encodePacked,
} from 'viem';
import * as viemChains from 'viem/chains';

import {
  EthereumAddress,
  getRpcUrl,
  networkMetadata,
  NetworkName,
  parseEthereumAddress,
} from '@blocksense/base-utils/evm';
import { valuesOf } from '@blocksense/base-utils/array-iter';

import { abi as UpgradableProxyADFSAbi } from './abi';

export class AggregatedDataFeedStore {
  public contract;
  public contractAddress: EthereumAddress;
  public client: PublicClient;
  private selectors = {
    getLatestIndex: '0x81',
    getLatestSingleData: '0x82',
    getLatestSingleDataAndIndex: '0x83',
    getLatestData: '0x84',
    getLatestDataAndIndex: '0x85',
    getFeedAtIndex: '0x86',
  } as const;

  constructor(address: string, networkName: NetworkName) {
    this.contractAddress = parseEthereumAddress(address);
    this.client = createPublicClient({
      chain: getViemChain(networkName),
      transport: http(getRpcUrl(networkName)),
    });

    this.contract = getContract({
      address: this.contractAddress,
      abi: UpgradableProxyADFSAbi,
      client: this.client,
    });
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

  private splitInto32bChunks(value: Hex): Hex[] {
    const regex = new RegExp(`(.{1,${64}})`, 'g');
    return value
      .slice(2)
      .split(regex)
      .filter(chunk => chunk.length > 0)
      .map(chunk => ('0x' + chunk) as Hex);
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

  async getLatestSingleDataAndIndex(feedId: bigint): Promise<IndexAndData> {
    const encoded = encodePacked(
      ['bytes1', 'uint128'],
      [this.selectors.getLatestSingleDataAndIndex, feedId],
    );
    const res = await this.call(encoded);
    const index = Number(res.slice(0, 66));
    const data = `0x${res.slice(66)}` as Hex;

    return { index, data };
  }

  async getLatestDataAndIndex(feedId: bigint): Promise<IndexAndData> {
    const encoded = encodePacked(
      ['bytes1', 'uint128'],
      [this.selectors.getLatestDataAndIndex, feedId],
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
      [this.selectors.getLatestDataAndIndex, feedId, startSlot, slots],
    );
    const res = await this.call(encoded);
    const index = Number(res.slice(0, 66));
    const data = this.splitInto32bChunks(`0x${res.slice(66)}`);

    return { index, data };
  }
}

type IndexAndData = { index: number; data: Hex | Hex[] };

function getViemChain(network: NetworkName): Chain | undefined {
  const id = networkMetadata[network].chainId;
  const chain = valuesOf(viemChains).find(chain => chain.id === id);
  if (!chain) {
    console.error(`Viem chain definition not found for network: ${network}`);
    return undefined;
  }
  return chain;
}

// Example usage

// Create an instance of AggregatedDataFeedStore
const adfs = new AggregatedDataFeedStore(
  parseEthereumAddress('0xADF5aacfA254FbC566d3b81e04b95db4bCF7b40F'),
  'base-sepolia',
);

const feedId = 0n; // Example feed ID
const index = 0; // Example index
const startSlot = 0; // Example start slot

// Usage of getLatestSingleData
const latestSingleData = await adfs.getLatestSingleData(feedId);
console.log(`Latest single data:`);
console.log(latestSingleData);

// Usage of getLatestData
const latestData = await adfs.getLatestData(feedId);
console.log(`Latest data: `);
console.log(latestData);

// Usage of getLatestDataSlice
const latestDataSlice = await adfs.getLatestDataSlice(feedId, startSlot);
console.log(`Latest data slice: `);
console.log(latestDataSlice);

// Usage of getSingleDataAtIndex
const singleDataAtIndex = await adfs.getSingleDataAtIndex(feedId, index);
console.log(`Single data at index ${index}:`);
console.log(singleDataAtIndex);

// Usage of getDataAtIndex
const dataAtIndex = await adfs.getDataAtIndex(feedId, index);
console.log(`Data at index ${index}:`);
console.log(dataAtIndex);

// Usage of getDataSliceAtIndex
const dataSliceAtIndex = await adfs.getDataSliceAtIndex(
  feedId,
  index,
  startSlot,
);
console.log(`Data slice at index ${index}:`);
console.log(dataSliceAtIndex);

// Usage of getLatestIndex
const latestIndex = await adfs.getLatestIndex(feedId);
console.log(`Latest index: ${latestIndex}`);

// Usage of getLatestSingleDataAndIndex
const latestSingleDataAndIndex = await adfs.getLatestSingleDataAndIndex(feedId);
console.log(`Latest single data and index:`);
console.log(latestSingleDataAndIndex);

// Usage of getLatestDataAndIndex
const latestDataAndIndex = await adfs.getLatestDataAndIndex(feedId);
console.log(`Latest data and index:`);
console.log(latestDataAndIndex);

// Usage of getLatestDataSliceAndIndex
const latestDataSliceAndIndex = await adfs.getLatestDataSliceAndIndex(
  feedId,
  startSlot,
);
console.log(`Latest data slice and index:`);
console.log(latestDataSliceAndIndex);
