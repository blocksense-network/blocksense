import { CLBaseWrapper } from '../Base';
import { expect } from 'chai';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import {
  CLFeedRegistryAdapter,
  UpgradeableProxyADFS,
} from '@blocksense/contracts/typechain';
import { deployContract } from '../../../../experiments/utils/helpers/common';

export class CLRegistryBaseWrapper {
  public name!: string;
  public contract!: CLFeedRegistryAdapter;
  public owner!: HardhatEthersSigner;
  public map: Record<string, Record<string, CLBaseWrapper>> = {};
  public dataFeedStore!: UpgradeableProxyADFS;

  constructor(name: string, _dataFeedStore: UpgradeableProxyADFS) {
    this.name = name;
    this.dataFeedStore = _dataFeedStore;
  }

  public async setFeeds(
    feeds: {
      base: string;
      quote: string;
      feed: CLBaseWrapper;
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

  public async checkLatestAnswer(
    caller: HardhatEthersSigner,
    base: string,
    quote: string,
    answer: string,
  ) {
    const clAdapter = this.map[base][quote];
    const parsedDataRes = clAdapter.getParsedData(answer);
    expect(await this.contract.latestAnswer(base, quote)).to.be.equal(
      parsedDataRes.decimal,
    );
    await clAdapter.checkLatestAnswer(caller, answer);
  }

  public async checkLatestRound(
    caller: HardhatEthersSigner,
    base: string,
    quote: string,
    round: bigint,
  ) {
    expect(round).to.be.equal(await this.contract.latestRound(base, quote));
    await this.map[base][quote].checkLatestRoundId(caller, round);
  }

  public async checkLatestRoundData(
    caller: HardhatEthersSigner,
    base: string,
    quote: string,
    answer: string,
    round: bigint,
  ) {
    const clAdapter = this.map[base][quote];
    const parsedDataRes = clAdapter.getParsedData(answer);

    const roundData = await this.contract.latestRoundData(base, quote);
    expect(roundData[0]).to.be.equal(round);
    expect(roundData[1]).to.be.equal(parsedDataRes.decimal);
    expect(roundData[2]).to.be.equal(parsedDataRes.timestamp);
    expect(roundData[3]).to.be.equal(parsedDataRes.timestamp);
    expect(roundData[4]).to.be.equal(round);

    await this.map[base][quote].checkLatestRoundData(caller, answer, round);
  }

  public async checkRoundData(
    caller: HardhatEthersSigner,
    base: string,
    quote: string,
    answer: string,
    round: bigint,
  ) {
    const clAdapter = this.map[base][quote];
    const parsedDataRes = clAdapter.getParsedData(answer);

    const roundData = await this.contract.getRoundData(base, quote, round);
    expect(roundData[0]).to.be.equal(round);
    expect(roundData[1]).to.be.equal(parsedDataRes.decimal);
    expect(roundData[2]).to.be.equal(parsedDataRes.timestamp);
    expect(roundData[3]).to.be.equal(parsedDataRes.timestamp);
    expect(roundData[4]).to.be.equal(round);

    await clAdapter.checkRoundData(caller, answer, round);
  }

  public async init(owner: HardhatEthersSigner) {
    this.owner = owner;
    this.contract = (await deployContract<CLFeedRegistryAdapter>(
      'CLFeedRegistryAdapter',
      owner.address,
      this.dataFeedStore.target,
    )) as CLFeedRegistryAdapter;
  }

  public getName(): string {
    return this.name;
  }
}
