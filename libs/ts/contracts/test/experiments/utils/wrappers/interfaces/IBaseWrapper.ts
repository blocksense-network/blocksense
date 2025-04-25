import { BaseContract } from 'ethers';

export interface IBaseWrapper<T extends BaseContract> {
  contract: T;

  init(...args: any[]): Promise<void>;

  getName(): string;
}
