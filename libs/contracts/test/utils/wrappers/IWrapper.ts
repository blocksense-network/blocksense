import { ethers } from 'ethers';

export interface IWrapper<T extends ethers.BaseContract> {
  contract: T;
  setterSelector: string;

  init(): Promise<void>;

  setFeeds(keys: number[], values: string[], ...args: any[]): Promise<any>;

  checkSetValues(keys: number[], values: string[]): Promise<void>;

  getName(): string;
}
