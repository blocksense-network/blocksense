import { ethers } from 'hardhat';
import { expect } from 'chai';
import { IADFSWrapper } from '../interfaces/IADFSWrapper';
import { AggregatedDataFeedStore } from '../../../../typechain';
import { AccessControlWrapper } from './AccessControl';
import { Feed, ReadOp } from '../types';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

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
  ): Promise<any> {
    return sequencer.sendTransaction({
      to: this.contract.target,
      data: this.encodeDataWrite(feeds, opts.blockNumber),
      ...opts.txData,
    });
  }

  public async checkLatestValue(
    sequencer: HardhatEthersSigner,
    feeds: Feed[],
    opts: {
      txData?: any;
    } = {},
  ): Promise<void> {
    for (const feed of feeds) {
      const storedValue = await sequencer.call({
        to: this.contract.target,
        data: this.encodeDataRead(ReadOp.GetLatestFeed, feed),
        ...opts.txData,
      });

      expect(storedValue).to.equal(this.formatData(feed.data));
    }
  }

  public async checkLatestRound(
    sequencer: HardhatEthersSigner,
    feeds: Feed[],
    opts: {
      txData?: any;
    } = {},
  ): Promise<void> {
    for (const feed of feeds) {
      const round = await sequencer.call({
        to: this.contract.target,
        data: this.encodeDataRead(ReadOp.GetLatestRound, feed),
        ...opts.txData,
      });

      expect(+round).to.equal(feed.round);
    }
  }

  public async checkValueAtRound(
    sequencer: HardhatEthersSigner,
    feeds: Feed[],
    opts: {
      txData?: any;
    } = {},
  ): Promise<void> {
    for (const feed of feeds) {
      const storedValue = await sequencer.call({
        to: this.contract.target,
        data: this.encodeDataRead(ReadOp.GetFeedAtRound, feed),
        ...opts.txData,
      });

      expect(storedValue).to.equal(this.formatData(feed.data));
    }
  }

  public async checkLatestFeedAndRound(
    sequencer: HardhatEthersSigner,
    feeds: Feed[],
    opts: {
      txData?: any;
    } = {},
  ): Promise<void> {
    for (const feed of feeds) {
      const storedValue = await sequencer.call({
        to: this.contract.target,
        data: this.encodeDataRead(ReadOp.GetLatestFeedAndRound, feed),
        ...opts.txData,
      });

      expect(storedValue).to.be.equal(
        ethers
          .toBeHex(feed.round, 32)
          .concat(this.formatData(feed.data).slice(2)),
      );
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
      ['0x00', blockNumber, feeds.length],
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

    feeds.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

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

  public encodeDataRead = (operation: ReadOp, feed: Feed) => {
    const feedIdInBytesLength = Math.ceil(feed.id.toString(2).length / 4);
    const prefix = ethers.solidityPacked(
      ['bytes1', 'uint8', 'uint8', `uint${8n * BigInt(feedIdInBytesLength)}`],
      [
        ethers.toBeHex(operation | 0x80),
        feed.stride,
        feedIdInBytesLength,
        feed.id,
      ],
    );
    const slots = Math.ceil((feed.data.length - 2) / 64);

    if (operation === ReadOp.GetFeedAtRound) {
      return prefix.concat(
        ethers
          .solidityPacked(['uint16', 'uint32'], [feed.round, slots])
          .slice(2),
      );
    }

    if (
      operation === ReadOp.GetLatestFeed ||
      operation === ReadOp.GetLatestFeedAndRound
    ) {
      return prefix.concat(ethers.solidityPacked(['uint32'], [slots]).slice(2));
    }

    return prefix;
  };

  public formatData = (data: string) => {
    const slots = Math.ceil((data.length - 2) / 64);
    return '0x' + data.slice(2).padStart(slots * 64, '0');
  };

  public abstract init(
    accessControlData: HardhatEthersSigner | string,
  ): Promise<void>;

  public abstract getName(): string;
}
