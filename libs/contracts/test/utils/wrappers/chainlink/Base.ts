import { ChainlinkProxy, IChainlinkAggregator } from '../../../../typechain';
import { BaseContract } from 'ethers';
import { expect } from 'chai';
import { UpgradeableProxyHistoricBaseWrapper } from '../upgradeable/historic/Base';
import { IBaseWrapper } from '../interfaces/IBaseWrapper';
import { ethers } from 'hardhat';

export abstract class ChainlinkBaseWrapper<T extends BaseContract> {
  public contract!: IChainlinkAggregator;
  public proxy!: UpgradeableProxyHistoricBaseWrapper<T>;
  public key!: number;

  public async setFeed(value: string): Promise<any> {
    return this.proxy.setFeeds([this.key], [value]);
  }

  public async checkSetValue(value: string): Promise<void> {
    return this.proxy.checkSetValues([this.key], [value]);
  }

  public async checkDecimals(decimals: number): Promise<void> {
    expect(await this.contract.decimals()).to.be.eq(decimals);
  }

  public async checkDescription(description: string): Promise<void> {
    expect(await this.contract.description()).to.be.eq(description);
  }

  public async checkLatestAnswer(): Promise<void> {
    const latestAnswer = await this.contract.latestAnswer();
    const data = await this.proxy.getValue(
      this.proxy.implementation.getLatestValueData(this.key),
    );
    const parsedData = this.proxy.implementation.getParsedData(data);

    expect(this.getHexAnswer(latestAnswer)).to.be.eq(parsedData.value);
  }

  public async checkLatestRoundData(): Promise<void> {
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

    expect(roundData[0]).to.be.eq(counter);
    expect(this.getHexAnswer(roundData[1])).to.be.eq(parsedData.value);
    expect(roundData[2].toString()).to.be.eq(parsedData.timestamp);
    expect(roundData[3].toString()).to.be.eq(parsedData.timestamp);
    expect(roundData[4]).to.be.eq(counter);
  }

  public async checkRoundData(roundId: number): Promise<void> {
    const roundData = await this.contract.getRoundData(roundId);
    const data = await this.proxy.getValue(
      this.proxy.implementation.getValueAtCounterData(this.key, roundId),
    );
    const parsedData = this.proxy.implementation.getParsedData(data);

    expect(roundData[0]).to.be.eq(roundId);
    expect(this.getHexAnswer(roundData[1])).to.be.eq(parsedData.value);
    expect(roundData[2].toString()).to.be.eq(parsedData.timestamp);
    expect(roundData[3].toString()).to.be.eq(parsedData.timestamp);
    expect(roundData[4]).to.be.eq(roundId);
  }

  protected getHexAnswer(value: bigint): string {
    return ethers.toBeHex(value.toString()).padEnd(66, '0');
  }

  public abstract init(...args: any[]): Promise<void>;

  public abstract getName(): string;
}
