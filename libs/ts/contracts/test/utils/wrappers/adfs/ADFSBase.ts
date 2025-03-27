import { ethers } from 'hardhat';
import { expect } from 'chai';
import { IADFSWrapper } from '../interfaces/IADFSWrapper';
import { AggregatedDataFeedStore } from '../../../../typechain';
import { AccessControlWrapper } from './AccessControl';
import { Feed, ReadFeed, ReadOp, WriteOp } from '../types';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { EventFragment, TransactionReceipt } from 'ethers';

export abstract class ADFSBaseWrapper implements IADFSWrapper {
  public contract!: AggregatedDataFeedStore;
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

  public checkEvent(receipt: TransactionReceipt, newBlockNumber: number): void {
    const fragment = this.getEventFragment();
    const parsedEvent = this.contract.interface.decodeEventLog(
      fragment,
      receipt.logs[0].data,
    );

    expect(parsedEvent[0]).to.be.eq(newBlockNumber);
  }

  public getEventFragment(): EventFragment {
    return ethers.EventFragment.from({
      name: 'DataFeedsUpdated',
      inputs: [
        {
          type: 'uint256',
          name: 'newBlockNumber',
        },
      ],
    });
  }

  public async checkLatestValue(
    caller: HardhatEthersSigner,
    feeds: Feed[],
    opts: {
      txData?: any;
    } = {},
  ) {
    for (const feed of feeds) {
      const storedValue = await caller.call({
        to: this.contract.target,
        data: this.encodeDataRead(ReadOp.GetLatestFeed, feed),
        ...opts.txData,
      });

      expect(storedValue).to.equal(this.formatData(feed));
    }
  }

  public async checkLatestRound(
    caller: HardhatEthersSigner,
    feeds: Feed[],
    opts: {
      txData?: any;
    } = {},
  ) {
    for (const feed of feeds) {
      const round = await caller.call({
        to: this.contract.target,
        data: this.encodeDataRead(ReadOp.GetLatestRound, feed),
        ...opts.txData,
      });

      expect(+round).to.equal(feed.round);
    }
  }

  public async checkValueAtRound(
    caller: HardhatEthersSigner,
    feeds: Feed[],
    opts: {
      txData?: any;
    } = {},
  ) {
    for (const feed of feeds) {
      const storedValue = await caller.call({
        to: this.contract.target,
        data: this.encodeDataRead(ReadOp.GetFeedAtRound, feed),
        ...opts.txData,
      });

      expect(storedValue).to.equal(this.formatData(feed));
    }
  }

  public async checkLatestFeedAndRound(
    caller: HardhatEthersSigner,
    feeds: Feed[],
    opts: {
      txData?: any;
    } = {},
  ) {
    for (const feed of feeds) {
      const storedValue = await caller.call({
        to: this.contract.target,
        data: this.encodeDataRead(ReadOp.GetLatestFeedAndRound, feed),
        ...opts.txData,
      });

      expect(storedValue).to.be.equal(
        ethers.toBeHex(feed.round, 32).concat(this.formatData(feed).slice(2)),
      );
    }
  }

  public async getValues(
    caller: HardhatEthersSigner,
    feeds: ReadFeed[],
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
          opts.operations ? opts.operations[index] : ReadOp.GetLatestFeed,
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
    const prefix = ethers.solidityPacked(
      ['bytes1', 'uint64', 'uint32'],
      [ethers.toBeHex(WriteOp.SetFeeds), blockNumber, feeds.length],
    );

    const data = feeds.map(feed => {
      const index = (feed.id * 2n ** 13n + feed.round) * 2n ** feed.stride;
      const indexInBytesLength = Math.ceil(index.toString(2).length / 8);
      const bytes = (feed.data.length - 2) / 2;
      const bytesLength = Math.ceil(bytes.toString(2).length / 8);

      return ethers
        .solidityPacked(
          [
            'uint8',
            'uint8',
            `uint${8n * BigInt(indexInBytesLength)}`,
            'uint8',
            `uint${8n * BigInt(bytesLength)}`,
            'bytes',
          ],
          [
            feed.stride,
            indexInBytesLength,
            index,
            bytesLength,
            bytes,
            feed.data,
          ],
        )
        .slice(2);
    });

    const batchFeeds: { [key: string]: string } = {};

    feeds.forEach(feed => {
      const rowIndex = ((2n ** 115n * feed.stride + feed.id) / 16n).toString();
      const slotPosition = Number(feed.id % 16n);

      if (!batchFeeds[rowIndex]) {
        // Initialize new row with zeros
        batchFeeds[rowIndex] = '0x' + '0'.repeat(64);
      }

      // Convert round to 2b hex and pad if needed
      const roundHex = feed.round.toString(16).padStart(4, '0');

      // Calculate position in the 32b row (64 hex chars)
      const position = slotPosition * 4;

      // Replace the corresponding 2b in the row
      batchFeeds[rowIndex] =
        batchFeeds[rowIndex].slice(0, position + 2) +
        roundHex +
        batchFeeds[rowIndex].slice(position + 6);
    });

    const roundData = Object.keys(batchFeeds)
      .map(index => {
        const indexInBytesLength = Math.ceil(
          BigInt(index).toString(2).length / 8,
        );

        return ethers
          .solidityPacked(
            ['uint8', `uint${8n * BigInt(indexInBytesLength)}`, 'bytes32'],
            [indexInBytesLength, BigInt(index), batchFeeds[index]],
          )
          .slice(2);
      })
      .join('');

    return prefix.concat(data.join('')).concat(roundData);
  };

  public encodeDataRead = (operation: ReadOp, feed: ReadFeed) => {
    const prefix = ethers.solidityPacked(
      ['bytes1', 'uint8', 'uint120'],
      [ethers.toBeHex(operation | 0x80), feed.stride, feed.id],
    );

    const optionalParameters: any[] = [
      feed.startSlotToReadFrom ?? 0,
      feed.slotsToRead ?? 0,
    ];

    // Remove trailing zeros (remove unused parameter values)
    for (let i = optionalParameters.length - 1; i >= 0; i--) {
      if (optionalParameters[i] === 0) {
        optionalParameters.splice(i, 1);
      } else {
        break;
      }
    }
    const types = Array(optionalParameters.length).fill('uint32');

    if (operation === ReadOp.GetFeedAtRound) {
      return prefix.concat(
        ethers
          .solidityPacked(
            ['uint16', ...types],
            [feed.round, ...optionalParameters],
          )
          .slice(2),
      );
    }

    if (
      operation === ReadOp.GetLatestFeed ||
      operation === ReadOp.GetLatestFeedAndRound
    ) {
      return prefix.concat(
        ethers.solidityPacked(types, optionalParameters).slice(2),
      );
    }

    return prefix;
  };

  public formatData = (feed: Feed) => {
    const dataSlots = Math.ceil((feed.data.length - 2) / 64);
    const startIndex = 2 + (feed.startSlotToReadFrom ?? 0) * 64;

    if (feed.slotsToRead && feed.slotsToRead > dataSlots) {
      return (
        '0x' +
        feed.data
          .slice(startIndex, startIndex + feed.slotsToRead * 64)
          .padEnd(feed.slotsToRead * 64, '0')
      );
    }

    const slots = feed.slotsToRead ?? dataSlots;
    return (
      '0x' +
      feed.data
        .slice(startIndex, startIndex + slots * 64)
        .padStart(slots * 64, '0')
    );
  };

  public abstract init(
    accessControlData: HardhatEthersSigner | string,
  ): Promise<void>;

  public abstract getName(): string;
}
