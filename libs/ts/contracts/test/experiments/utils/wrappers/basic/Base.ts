import { expect } from 'chai';
import { BaseContract, ethers } from 'ethers';
import { network } from 'hardhat';
import { IWrapper } from '../../../utils/wrappers/interfaces/IWrapper';

export abstract class DataFeedStoreBaseWrapper<T extends BaseContract>
  implements IWrapper<T>
{
  public contract!: T;
  public readonly setterSelector: string;

  constructor(selector: string) {
    this.setterSelector = selector;
  }

  public async setFeeds(keys: number[], values: string[], ...args: any[]) {
    const params: any = {};
    params.to = this.contract.target;
    params.data = this.customSetFeedsData(this.setterSelector, keys, values);

    for (const arg of args) {
      Object.assign(params, arg);
    }

    const txHash = await network.provider.send('eth_sendTransaction', [params]);

    return network.provider.send('eth_getTransactionReceipt', [txHash]);
  }

  public customSetFeedsData(
    selector: string,
    keys: number[],
    values: string[],
  ): string {
    return ethers.solidityPacked(
      ['bytes4', ...keys.map(() => ['uint32', 'bytes32']).flat()],
      [selector, ...keys.flatMap((key, i) => [key, values[i]])],
    );
  }

  public async checkSetValues(keys: number[], values: string[]): Promise<void> {
    for (let i = 0; i < keys.length; i++) {
      const value = await this.getValue(this.getLatestValueData(keys[i]));
      expect(value).to.be.eq(values[i]);
    }
  }

  public async getValue(data: string, ...args: any[]): Promise<string> {
    const params: any = {};
    params.to = this.contract.target;
    params.data = data;

    for (const arg of args) {
      Object.assign(params, arg);
    }

    return network.provider.send('eth_call', [params, 'latest']);
  }

  public abstract init(): Promise<void>;

  public abstract getLatestValueData(key: number): string;

  public abstract getName(): string;
}
