import { ethers } from 'hardhat';
import { expect } from 'chai';
import { IADFSWrapper } from '../interfaces/IADFSWrapper';
import { AggregatedDataFeedStoreGeneric } from '../../../../typechain';
import { AccessControlWrapper } from './AccessControl';
import { Feed, ReadFeed, ReadOp } from '../types';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { EventFragment } from 'ethers';

export abstract class ADFSBaseGenericWrapper implements IADFSWrapper {
  public contract!: AggregatedDataFeedStoreGeneric;
  public accessControl!: AccessControlWrapper;

  public async setFeeds(
    sequencer: HardhatEthersSigner,
    feeds: Feed[],
    opts: {
      blockNumber?: number;
      txData?: any;
    } = {},
  ) {
    return sequencer.sendTransaction({
      to: this.contract.target,
      data: this.encodeDataWrite(feeds, opts.blockNumber),
      ...opts.txData,
    });
  }

  public checkEvent(receipt: any, newBlockNumber: number): void {
    const fragment = this.getEventFragment();
    const parsedEvent = this.contract.interface.decodeEventLog(
      fragment,
      receipt.logs[0].data,
    );

    expect(parsedEvent[0]).to.be.eq(newBlockNumber);
  }

  public getEventFragment(): EventFragment {
    return this.contract.interface.getEvent('DataFeedsUpdated')!;
  }

  public async checkLatestData(
    sequencer: HardhatEthersSigner,
    feeds: Feed[],
    opts: {
      txData?: any;
    } = {},
  ) {
    for (const feed of feeds) {
      const storedValue = await sequencer.call({
        to: this.contract.target,
        data: this.encodeDataRead(ReadOp.GetLatestData, feed),
        ...opts.txData,
      });

      expect(new ethers.AbiCoder().decode(['bytes'], storedValue)[0]).to.equal(
        this.formatData(feed),
      );
    }
  }

  public async checkLatestIndex(
    sequencer: HardhatEthersSigner,
    feeds: Feed[],
    opts: {
      txData?: any;
    } = {},
  ) {
    for (const feed of feeds) {
      const index = await sequencer.call({
        to: this.contract.target,
        data: this.encodeDataRead(ReadOp.GetLatestIndex, feed),
        ...opts.txData,
      });

      expect(+index).to.equal(feed.index);
    }
  }

  public async checkDataAtIndex(
    sequencer: HardhatEthersSigner,
    feeds: Feed[],
    opts: {
      txData?: any;
    } = {},
  ) {
    for (const feed of feeds) {
      const storedValue = await sequencer.call({
        to: this.contract.target,
        data: this.encodeDataRead(ReadOp.GetDataAtIndex, feed),
        ...opts.txData,
      });

      expect(new ethers.AbiCoder().decode(['bytes'], storedValue)[0]).to.equal(
        this.formatData(feed),
      );
    }
  }

  public async checkLatestDataAndIndex(
    sequencer: HardhatEthersSigner,
    feeds: Feed[],
    opts: {
      txData?: any;
    } = {},
  ) {
    for (const feed of feeds) {
      const storedValue = await sequencer.call({
        to: this.contract.target,
        data: this.encodeDataRead(ReadOp.GetLatestDataAndIndex, feed),
        ...opts.txData,
      });

      const parsed = new ethers.AbiCoder().decode(
        ['uint256', 'bytes'],
        storedValue,
      );

      expect(parsed[0]).to.be.equal(feed.index);
      expect(parsed[1]).to.be.equal(this.formatData(feed));
    }
  }

  public async getValues(
    caller: HardhatEthersSigner,
    feeds: Feed[],
    opts: {
      operations?: ReadOp[];
      txData?: any;
    } = {},
  ): Promise<string[]> {
    const results: string[] = [];
    for (const [index, feed] of feeds.entries()) {
      const res = await caller.call({
        to: this.contract.target,
        data: this.encodeDataRead(
          opts.operations ? opts.operations[index] : ReadOp.GetLatestData,
          feed,
        ),
        ...opts.txData,
      });

      results.push(res);
    }

    return results;
  }

  public encodeDataWrite = (feeds: Feed[], blockNumber?: number) => {
    blockNumber ??= Date.now() + 100;
    const indices = feeds.map(
      feed => (feed.id * 2n ** 13n + feed.index) * 2n ** feed.stride,
    );

    const batchFeeds: { [key: string]: string } = {};

    feeds.forEach(feed => {
      const rowIndex = ((2n ** 115n * feed.stride + feed.id) / 16n).toString();
      const slotPosition = Number(feed.id % 16n);

      if (!batchFeeds[rowIndex]) {
        // Initialize new row with zeros
        batchFeeds[rowIndex] = '0x' + '0'.repeat(64);
      }

      // Convert index to 2b hex and pad if needed
      const indexHex = feed.index.toString(16).padStart(4, '0');

      // Calculate position in the 32b row (64 hex chars)
      const position = slotPosition * 4;

      // Replace the corresponding 2b in the row
      batchFeeds[rowIndex] =
        batchFeeds[rowIndex].slice(0, position + 2) +
        indexHex +
        batchFeeds[rowIndex].slice(position + 6);
    });

    const indexTableIndices = Object.keys(batchFeeds).filter(
      key => batchFeeds[key] !== ethers.toBeHex(0, 32),
    );

    const indexTableData = indexTableIndices.map(key => batchFeeds[key]);

    return this.contract.interface.encodeFunctionData('write', [
      blockNumber,
      feeds.map(feed => feed.stride),
      indices,
      feeds.map(feed => feed.data),
      indexTableIndices,
      indexTableData,
    ]);
  };

  public encodeDataRead = (operation: ReadOp, feed: ReadFeed) => {
    const slots = feed.slotsToRead ?? Math.ceil((feed.data.length - 2) / 64);

    switch (operation) {
      case ReadOp.GetLatestData:
        return this.contract.interface.encodeFunctionData('getLatestData', [
          feed.stride,
          feed.id,
          feed.startSlotToReadFrom ?? 0,
          slots,
        ]);
      case ReadOp.GetLatestIndex:
        return this.contract.interface.encodeFunctionData('getLatestIndex', [
          feed.stride,
          feed.id,
        ]);
      case ReadOp.GetDataAtIndex:
        return this.contract.interface.encodeFunctionData('getDataAtIndex', [
          feed.stride,
          feed.id,
          feed.index,
          feed.startSlotToReadFrom ?? 0,

          slots,
        ]);
      case ReadOp.GetLatestDataAndIndex:
        return this.contract.interface.encodeFunctionData(
          'getLatestDataAndIndex',
          [feed.stride, feed.id, feed.startSlotToReadFrom ?? 0, slots],
        );
      default:
        throw new Error('Invalid operation');
    }
  };

  public formatData = (feed: Feed) => {
    const slots = feed.slotsToRead ?? Math.ceil((feed.data.length - 2) / 64);
    const startIndex = 2 + (feed.startSlotToReadFrom ?? 0) * 64;
    return (
      '0x' +
      feed.data
        .slice(startIndex, startIndex + slots * 64)
        .padEnd(slots * 64, '0')
    );
  };

  public abstract init(
    accessControlData: HardhatEthersSigner | string,
  ): Promise<void>;

  public abstract getName(): string;
}
