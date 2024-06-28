import { BaseContract } from 'ethers';
import { IWrapper } from '..';

export interface ISportsWrapper<T extends BaseContract> extends IWrapper<T> {
  checkEvents(receipt: any, keys: number[], descriptions: string[]): void;
}
