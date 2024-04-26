import { expect } from 'chai';
import { ethers } from 'ethers';
import { network } from 'hardhat';
import { DataFeedStore } from '../../helpers/common';
import { IWrapper } from '../IWrapper';

export abstract class DataFeedStoreBaseWrapper
  implements IWrapper<DataFeedStore>
{
  public contract!: DataFeedStore;
  public readonly setterSelector: string;

  constructor(selector: string) {
    this.setterSelector = selector;
  }

  public async setFeeds(keys: number[], values: string[], ...args: any[]) {
    return this.customSetFeeds(this.setterSelector, keys, values, ...args);
  }

  public async customSetFeeds(
    selector: string,
    keys: number[],
    values: string[],
    ...args: any[]
  ): Promise<any> {
    const params: any = {};
    params.to = this.contract.target;
    params.data = ethers.solidityPacked(
      ['bytes4', ...keys.map(() => ['uint32', 'bytes32']).flat()],
      [selector, ...keys.flatMap((key, i) => [key, values[i]])],
    );

    for (const arg of args) {
      Object.assign(params, arg);
    }

    const txHash = await network.provider.send('eth_sendTransaction', [params]);

    return network.provider.send('eth_getTransactionReceipt', [txHash]);
  }

  public async checkSetValues(keys: number[], values: string[]): Promise<void> {
    for (let i = 0; i < keys.length; i++) {
      const value = await this.getValue(this.getLatestValueSelector(keys[i]));
      expect(value).to.be.eq(values[i]);
    }
  }

  public async getValue(selector: string, ...args: any[]): Promise<string> {
    const params: any = {};
    params.to = this.contract.target;
    params.data = ethers.solidityPacked(['bytes4'], [selector]);

    for (const arg of args) {
      Object.assign(params, arg);
    }

    return network.provider.send('eth_call', [params, 'latest']);
  }

  public abstract init(): Promise<void>;

  public abstract getLatestValueSelector(key: number): string;

  public abstract getName(): string;
}
