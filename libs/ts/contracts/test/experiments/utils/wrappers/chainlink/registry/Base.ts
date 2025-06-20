import {
  CLFeedRegistryAdapterExp,
  UpgradeableProxy,
} from '@blocksense/contracts/typechain';
import { CLBaseWrapper } from '../Base';
import { expect } from 'chai';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import {
  HistoricalDataFeedStore,
  deployContract,
} from '../../../helpers/common';

export class CLRegistryBaseWrapper {
  public name!: string;
  public contract!: CLFeedRegistryAdapterExp;
  public owner!: HardhatEthersSigner;
  public map: Record<
    string,
    Record<string, CLBaseWrapper<HistoricalDataFeedStore>>
  > = {};
  public dataFeedStore!: UpgradeableProxy;

  constructor(name: string, _dataFeedStore: UpgradeableProxy) {
    this.name = name;
    this.dataFeedStore = _dataFeedStore;
  }

  public async setFeeds(
    feeds: {
      base: string;
      quote: string;
      feed: CLBaseWrapper<HistoricalDataFeedStore>;
    }[],
  ) {
    for (const feedData of feeds) {
      const { base, quote, feed } = feedData;
      this.map[base] = {};
      this.map[base][quote] = feed;
    }
    return this.contract.connect(this.owner).setFeeds(
      feeds.map(data => {
        return {
          base: data.base,
          quote: data.quote,
          feed: data.feed.contract.target,
        };
      }),
    );
  }

  public async checkFeed(base: string, quote: string, feed: string) {
    expect(feed).to.be.equal(await this.contract.getFeed(base, quote));
    expect(feed).to.be.equal(this.map[base][quote].contract.target);
  }

  public async checkDecimals(base: string, quote: string, decimals: number) {
    expect(decimals).to.be.equal(await this.contract.decimals(base, quote));
    await this.map[base][quote].checkDecimals(decimals);
  }

  public async checkDescription(
    base: string,
    quote: string,
    description: string,
  ) {
    expect(description).to.be.equal(
      await this.contract.description(base, quote),
    );
    await this.map[base][quote].checkDescription(description);
  }

  public async checkLatestAnswer(base: string, quote: string, answer: bigint) {
    expect(answer).to.be.equal(await this.contract.latestAnswer(base, quote));
    await this.map[base][quote].checkLatestAnswer(answer);
  }

  public async checkLatestRound(base: string, quote: string, round: number) {
    expect(round).to.be.equal(await this.contract.latestRound(base, quote));
    await this.map[base][quote].checkLatestRoundId(round);
  }

  public async checkLatestRoundData(
    base: string,
    quote: string,
    res: {
      answer: bigint;
      startedAt: number;
      roundId: bigint;
    },
  ) {
    const roundData = await this.contract.latestRoundData(base, quote);
    expect(res.roundId).to.be.equal(roundData[0]);
    expect(res.answer).to.be.equal(roundData[1]);
    expect(res.startedAt).to.be.equal(roundData[2]);
    expect(res.startedAt).to.be.equal(roundData[3]);
    expect(res.roundId).to.be.equal(roundData[4]);

    await this.map[base][quote].checkLatestRoundData(res);
  }

  public async checkRoundData(
    base: string,
    quote: string,
    roundId: number,
    res: { answer: bigint; startedAt: number },
  ) {
    const roundData = await this.contract.getRoundData(base, quote, roundId);
    expect(roundId).to.be.equal(roundData[0]);
    expect(res.answer).to.be.equal(roundData[1]);
    expect(res.startedAt).to.be.equal(roundData[2]);
    expect(res.startedAt).to.be.equal(roundData[3]);
    expect(roundId).to.be.equal(roundData[4]);

    await this.map[base][quote].checkRoundData(roundId, res);
  }

  public async init(owner: HardhatEthersSigner) {
    this.owner = owner;
    this.contract = (await deployContract<CLFeedRegistryAdapterExp>(
      'CLFeedRegistryAdapterExp',
      owner.address,
      this.dataFeedStore.target,
    )) as CLFeedRegistryAdapterExp;
  }

  public getName(): string {
    return this.name;
  }
}
