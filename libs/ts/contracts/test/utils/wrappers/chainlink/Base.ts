import { expect } from 'chai';
import { UpgradeableProxyADFSBaseWrapper } from '../adfs/UpgradeableProxyBase';
import { CLAggregatorAdapter } from '@blocksense/contracts/typechain';
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
    index: bigint,
    blockNumber?: number,
  ): Promise<any> {
    return this.proxy.proxyCall(
      'setFeeds',
      sequencer,
      [
        {
          id: this.id,
          index,
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
    return this.proxy.proxyCall('checkLatestData', caller, [
      {
        id: this.id,
        data: data,
        stride: 0n,
        index: 0n, // this is not used in this test
      },
    ]);
  }

  public async checkLatestRoundId(
    caller: HardhatEthersSigner,
    index: bigint,
  ): Promise<void> {
    const latestRoundId = await this.contract.latestRound();
    expect(latestRoundId).to.be.eq(index);

    await this.proxy.proxyCall('checkLatestIndex', caller, [
      {
        index,
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
      index: 0n, // this is not used in this test
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
    index: bigint,
  ): Promise<void> {
    const feed: Feed = {
      index,
      data: answer,
      id: this.id,
      stride: this.stride,
    };
    const roundData = await this.contract.latestRoundData();
    const data = (await this.proxy.proxyCall('getValues', caller, [feed]))[0];
    const counter = BigInt(
      (
        await this.proxy.proxyCall('getValues', caller, [feed], {
          operations: [ReadOp.GetLatestIndex],
        })
      )[0],
    );
    const parsedData = this.getParsedData(data);
    const parsedDataRes = this.getParsedData(feed.data);

    expect(roundData[0]).to.be.eq(feed.index);
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
    index: bigint,
  ): Promise<void> {
    const feed: Feed = {
      index,
      data: answer,
      id: this.id,
      stride: this.stride,
    };
    const roundData = await this.contract.getRoundData(feed.index);
    const data = (
      await this.proxy.proxyCall('getValues', caller, [feed], {
        operations: [ReadOp.GetDataAtIndex],
      })
    )[0];
    const parsedData = this.getParsedData(data);
    const parsedDataRes = this.getParsedData(feed.data);

    expect(roundData[1]).to.be.eq(parsedDataRes.decimal);
    expect(roundData[2]).to.be.eq(parsedData.timestamp);

    expect(roundData[0]).to.be.eq(feed.index);
    expect(roundData[1]).to.be.eq(parsedData.decimal);
    expect(roundData[2].toString()).to.be.eq(parsedData.timestamp);
    expect(roundData[3].toString()).to.be.eq(parsedData.timestamp);
    expect(roundData[4]).to.be.eq(feed.index);
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
