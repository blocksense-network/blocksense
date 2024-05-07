import { BaseContract } from 'ethers';
import { UpgradeableProxyBaseWrapper } from '../Base';
import { IHistoricWrapper } from '../../interfaces/IHistoricWrapper';

export abstract class UpgradeableProxyHistoricBaseWrapper<
  U extends BaseContract,
  T extends IHistoricWrapper<U>,
> extends UpgradeableProxyBaseWrapper<U, T> {
  public async checkSetTimestamps(
    keys: number[],
    blockNumbers: number[],
  ): Promise<any> {
    await this.implementation.checkSetTimestamps(keys, blockNumbers, {
      to: this.contract.target,
    });
  }

  public async checkSetValues(keys: number[], values: string[]): Promise<any> {
    await this.implementation.checkSetValues(keys, values, {
      to: this.contract.target,
    });
  }

  public async checkLatestCounter(
    key: number,
    expectedCounter: number,
  ): Promise<any> {
    await this.implementation.checkLatestCounter(key, expectedCounter, {
      to: this.contract.target,
    });
  }

  public async checkValueAtCounter(
    key: number,
    counter: number,
    value: string,
    blockNumber: number,
  ): Promise<any> {
    await this.implementation.checkValueAtCounter(
      key,
      counter,
      value,
      blockNumber,
      { to: this.contract.target },
    );
  }
}
