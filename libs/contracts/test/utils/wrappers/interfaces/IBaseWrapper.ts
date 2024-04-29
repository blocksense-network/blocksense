import { BaseContract } from 'ethers';

export interface IBaseWrapper<T extends BaseContract> {
  contract: T;

  init(): Promise<void>;

  checkSetValues(keys: number[], values: string[]): Promise<void>;

  getName(): string;
}
