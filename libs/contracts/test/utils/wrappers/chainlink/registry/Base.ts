import { BaseContract } from 'ethers';
import { FeedRegistry } from '../../../../../typechain';
import { ChainlinkBaseWrapper } from '../Base';
import { expect } from 'chai';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

export abstract class ChainlinkRegistryBaseWrapper<T extends BaseContract> {
  public contract!: FeedRegistry;
  public owner!: HardhatEthersSigner;
  public map: Record<string, Record<string, ChainlinkBaseWrapper<T>>> = {};

  public async setFeed(
    base: string,
    quote: string,
    feed: ChainlinkBaseWrapper<T>,
  ) {
    this.map[base] = {};
    this.map[base][quote] = feed;
    return this.contract
      .connect(this.owner)
      .setFeed(base, quote, feed.contract.target);
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
    expect(res.answer).to.be.equal(roundData.answer);
    expect(res.startedAt).to.be.equal(roundData.startedAt);
    expect(res.startedAt).to.be.equal(roundData.updatedAt);
    expect(res.roundId).to.be.equal(roundData.roundId);
    expect(res.roundId).to.be.equal(roundData.answeredInRound);

    await this.map[base][quote].checkLatestRoundData(res);
  }

  public async checkRoundData(
    base: string,
    quote: string,
    roundId: number,
    res: { answer: bigint; startedAt: number },
  ) {
    const roundData = await this.contract.getRoundData(base, quote, roundId);
    expect(res.answer).to.be.equal(roundData.answer);
    expect(res.startedAt).to.be.equal(roundData.startedAt);
    expect(res.startedAt).to.be.equal(roundData.updatedAt);
    expect(roundId).to.be.equal(roundData.roundId);
    expect(roundId).to.be.equal(roundData.answeredInRound);

    await this.map[base][quote].checkRoundData(roundId, res);
  }

  public abstract init(owner: HardhatEthersSigner): Promise<void>;

  public abstract getName(): string;
}
