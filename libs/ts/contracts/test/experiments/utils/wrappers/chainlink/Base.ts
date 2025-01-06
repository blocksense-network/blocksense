import { CLAggregatorAdapterExp } from '../../../../../typechain';
import { BaseContract } from 'ethers';
import { expect } from 'chai';
import { UpgradeableProxyHistoricalBaseWrapper } from '../upgradeable/historical/Base';

export abstract class CLBaseWrapper<T extends BaseContract> {
  public contract!: CLAggregatorAdapterExp;
  public proxy!: UpgradeableProxyHistoricalBaseWrapper<T>;
  public key!: number;

  public async setFeed(value: string): Promise<any> {
    return this.proxy.setFeeds([this.key], [value]);
  }

  public async checkSetValue(value: string): Promise<void> {
    return this.proxy.checkSetValues([this.key], [value]);
  }

  public async checkLatestRoundId(roundId: number): Promise<void> {
    const latestRoundId = await this.contract.latestRound();
    const counter = BigInt(
      await this.proxy.getValue(
        this.proxy.implementation.getLatestCounterData(this.key),
      ),
    );

    expect(latestRoundId).to.be.eq(roundId);
    expect(latestRoundId).to.be.eq(counter);
  }

  public async checkDecimals(decimals: number): Promise<void> {
    expect(await this.contract.decimals()).to.be.eq(decimals);
  }

  public async checkDescription(description: string): Promise<void> {
    expect(await this.contract.description()).to.be.eq(description);
  }

  public async checkLatestAnswer(answer: bigint): Promise<void> {
    const latestAnswer = await this.contract.latestAnswer();
    const data = await this.proxy.getValue(
      this.proxy.implementation.getLatestValueData(this.key),
    );
    const parsedData = this.proxy.implementation.getParsedData(data);

    expect(parsedData.value).to.be.eq(this.getHexAnswer(answer));
    expect(this.getHexAnswer(latestAnswer)).to.be.eq(parsedData.value);
  }

  public async checkLatestRoundData(res: {
    answer: bigint;
    startedAt: number;
    roundId: bigint;
  }): Promise<void> {
    const roundData = await this.contract.latestRoundData();
    const data = await this.proxy.getValue(
      this.proxy.implementation.getLatestValueData(this.key),
    );
    const counter = BigInt(
      await this.proxy.getValue(
        this.proxy.implementation.getLatestCounterData(this.key),
      ),
    );
    const parsedData = this.proxy.implementation.getParsedData(data);

    expect(roundData[0]).to.be.eq(res.roundId);
    expect(roundData[1]).to.be.eq(res.answer);
    expect(roundData[2]).to.be.eq(res.startedAt);

    expect(roundData[0]).to.be.eq(counter);
    expect(this.getHexAnswer(roundData[1])).to.be.eq(parsedData.value);
    expect(roundData[2].toString()).to.be.eq(parsedData.timestamp);
    expect(roundData[3].toString()).to.be.eq(parsedData.timestamp);
    expect(roundData[4]).to.be.eq(counter);
  }

  public async checkRoundData(
    roundId: number,
    res: { answer: bigint; startedAt: number },
  ): Promise<void> {
    const roundData = await this.contract.getRoundData(roundId);
    const data = await this.proxy.getValue(
      this.proxy.implementation.getValueAtCounterData(this.key, roundId),
    );
    const parsedData = this.proxy.implementation.getParsedData(data);

    expect(roundData[1]).to.be.eq(res.answer);
    expect(roundData[2]).to.be.eq(res.startedAt);

    expect(roundData[0]).to.be.eq(roundId);
    expect(this.getHexAnswer(roundData[1])).to.be.eq(parsedData.value);
    expect(roundData[2].toString()).to.be.eq(parsedData.timestamp);
    expect(roundData[3].toString()).to.be.eq(parsedData.timestamp);
    expect(roundData[4]).to.be.eq(roundId);
  }

  protected getHexAnswer(value: bigint): string {
    return '0x' + value.toString(16).padStart(48, '0').padEnd(64, '0');
  }

  public abstract init(...args: any[]): Promise<void>;

  public abstract getName(): string;
}
