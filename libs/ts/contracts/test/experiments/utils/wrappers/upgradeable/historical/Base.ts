import { BaseContract } from 'ethers';
import { UpgradeableProxyBaseWrapper } from '../Base';
import { IHistoricalWrapper } from '../../../../utils/wrappers/interfaces/IHistoricalWrapper';

export abstract class UpgradeableProxyHistoricalBaseWrapper<
  U extends BaseContract,
> extends UpgradeableProxyBaseWrapper<U> {
  declare public implementation: IHistoricalWrapper<U>;

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
