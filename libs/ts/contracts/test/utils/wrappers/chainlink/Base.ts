import { expect } from 'chai';
import { UpgradeableProxyADFSBaseWrapper } from '../adfs/UpgradeableProxyBase';
import { CLAggregatorAdapter } from '../../../../typechain';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { Feed, ReadOp } from '../types';

export abstract class CLBaseWrapper {
  public contract!: CLAggregatorAdapter;
  public proxy!: UpgradeableProxyADFSBaseWrapper;
  public id!: bigint;
  public stride: bigint = 0n;

  public async setFeed(
    sequencer: HardhatEthersSigner,
    data: string,
    round: bigint,
    blockNumber?: number,
  ): Promise<any> {
    return this.proxy.proxyCall(
      'setFeeds',
      sequencer,
      [
        {
          id: this.id,
          round,
          data,
          stride: this.stride,
        },
      ],
      {
        blockNumber,
      },
    );
  }

  public async checkSetValue(
    caller: HardhatEthersSigner,
    data: string,
  ): Promise<void> {
    return this.proxy.proxyCall('checkLatestValue', caller, [
      {
        id: this.id,
        data: data,
        stride: 0n,
        round: 0n, // this is not used in this test
      },
    ]);
  }

  public async checkLatestRoundId(
    caller: HardhatEthersSigner,
    round: bigint,
  ): Promise<void> {
    const latestRoundId = await this.contract.latestRound();
    expect(latestRoundId).to.be.eq(round);

    await this.proxy.proxyCall('checkLatestRound', caller, [
      {
        round,
        data: '', // this is not used in this test
        id: this.id,
        stride: this.stride,
      },
    ]);
  }

  public async checkDecimals(decimals: number): Promise<void> {
    expect(await this.contract.decimals()).to.be.eq(decimals);
  }

  public async checkDescription(description: string): Promise<void> {
    expect(await this.contract.description()).to.be.eq(description);
  }

  public async checkId(id: number): Promise<void> {
    expect(await this.contract.id()).to.be.eq(id);
  }

  public async checkLatestAnswer(
    caller: HardhatEthersSigner,
    answer: string,
  ): Promise<void> {
    const feed: Feed = {
      round: 0n, // this is not used in this test
      data: answer,
      id: this.id,
      stride: this.stride,
    };
    const latestAnswer = await this.contract.latestAnswer();
    const data = (await this.proxy.proxyCall('getValues', caller, [feed]))[0];
    const parsedData = this.getParsedData(data);
    const parsedDataRes = this.getParsedData(feed.data);

    expect(parsedData.value).to.be.eq(parsedDataRes.value);
    expect(latestAnswer).to.be.eq(parsedData.decimal);
  }

  public async checkLatestRoundData(
    caller: HardhatEthersSigner,
    answer: string,
    round: bigint,
  ): Promise<void> {
    const feed: Feed = {
      round,
      data: answer,
      id: this.id,
      stride: this.stride,
    };
    const roundData = await this.contract.latestRoundData();
    const data = (await this.proxy.proxyCall('getValues', caller, [feed]))[0];
    const counter = BigInt(
      (
        await this.proxy.proxyCall('getValues', caller, [feed], {
          operations: [ReadOp.GetLatestRound],
        })
      )[0],
    );
    const parsedData = this.getParsedData(data);
    const parsedDataRes = this.getParsedData(feed.data);

    expect(roundData[0]).to.be.eq(feed.round);
    expect(roundData[1]).to.be.eq(parsedDataRes.decimal);
    expect(roundData[2]).to.be.eq(parsedData.timestamp);

    expect(roundData[0]).to.be.eq(counter);
    expect(roundData[1]).to.be.eq(parsedData.decimal);
    expect(roundData[2].toString()).to.be.eq(parsedData.timestamp);
    expect(roundData[3].toString()).to.be.eq(parsedData.timestamp);
    expect(roundData[4]).to.be.eq(counter);
  }

  public async checkRoundData(
    caller: HardhatEthersSigner,
    answer: string,
    round: bigint,
  ): Promise<void> {
    const feed: Feed = {
      round,
      data: answer,
      id: this.id,
      stride: this.stride,
    };
    const roundData = await this.contract.getRoundData(feed.round);
    const data = (
      await this.proxy.proxyCall('getValues', caller, [feed], {
        operations: [ReadOp.GetFeedAtRound],
      })
    )[0];
    const parsedData = this.getParsedData(data);
    const parsedDataRes = this.getParsedData(feed.data);

    expect(roundData[1]).to.be.eq(parsedDataRes.decimal);
    expect(roundData[2]).to.be.eq(parsedData.timestamp);

    expect(roundData[0]).to.be.eq(feed.round);
    expect(roundData[1]).to.be.eq(parsedData.decimal);
    expect(roundData[2].toString()).to.be.eq(parsedData.timestamp);
    expect(roundData[3].toString()).to.be.eq(parsedData.timestamp);
    expect(roundData[4]).to.be.eq(feed.round);
  }

  public getHexAnswer(value: bigint): string {
    return '0x' + value.toString(16).padStart(48, '0').padEnd(64, '0');
  }

  public getParsedData(data: string): any {
    const value = data.slice(0, 50).padEnd(66, '0');
    const timestamp = BigInt('0x' + data.slice(50, 66)) / 1000n;
    const decimal = BigInt(data.slice(0, 50));

    return { value, timestamp, decimal };
  }

  public abstract init(...args: any[]): Promise<void>;

  public abstract getName(): string;
}
