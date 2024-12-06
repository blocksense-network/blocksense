import { BaseContract, ethers } from 'ethers';
import { IWrapper } from '../../../utils/wrappers/interfaces/IWrapper';
import { expect } from 'chai';
import { network } from 'hardhat';

export abstract class SportsDataFeedStoreBaseWrapper<T extends BaseContract>
  implements IWrapper<T>
{
  public contract!: T;
  public readonly setterSelector: string;

  constructor(selector: string) {
    this.setterSelector = selector;
  }

  public async setFeeds(
    keys: number[],
    values: string[],
    descriptions: string[],
    ...args: any[]
  ) {
    const params: any = {};
    params.to = this.contract.target;
    params.data = this.customSetFeedsData(
      this.setterSelector,
      keys,
      values,
      descriptions,
    );

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
    descriptions: string[],
  ): string {
    let packedTypes: string[] = ['bytes4'];
    let packedValues: any[] = [selector];

    for (const [i, value] of values.entries()) {
      const parsedValue = value.split(';');

      // key
      packedTypes.push('uint32');
      packedValues.push(keys[i]);

      // len
      packedTypes.push('uint16');
      packedValues.push(parsedValue.length);

      // values & description (+1)
      packedTypes.push(...new Array(parsedValue.length + 1).fill('bytes32'));
      packedValues.push(...parsedValue, descriptions[i]);
    }

    return ethers.solidityPacked(packedTypes, packedValues);
  }

  public async checkSetValues(keys: number[], values: string[]): Promise<void> {
    for (let i = 0; i < keys.length; i++) {
      const parsedValues = values[i].split(';');
      const value = await this.getValue(
        this.getLatestValueData(keys[i], parsedValues.length),
      );

      const reconstructedValues =
        parsedValues[0] +
        parsedValues
          .slice(1)
          .map(v => v.slice(2))
          .join('');
      expect(value).to.be.eq(reconstructedValues);
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

  public getLatestValueData(key: number, slotsPerKey: number): string {
    return (
      '0x' +
      ((key | 0x80000000) >>> 0).toString(16).padStart(8, '0') +
      slotsPerKey.toString(16).padStart(64, '0')
    );
  }

  public checkEvents(
    receipt: any,
    keys: number[],
    descriptions: string[],
  ): void {
    const fragment = this.getEventFragment();
    for (let i = 0; i < keys.length; i++) {
      const parsedEvent = this.contract.interface.decodeEventLog(
        fragment,
        receipt.logs[i].data,
      );

      expect(parsedEvent[0]).to.be.eq(keys[i]);
      expect(parsedEvent[1]).to.be.eq(descriptions[i]);
    }
  }

  public getEventFragment(): ethers.EventFragment {
    return ethers.EventFragment.from({
      name: 'DataFeedSet',
      inputs: [
        {
          type: 'uint32',
          name: 'key',
        },
        {
          type: 'bytes32',
          name: 'description',
        },
      ],
    });
  }

  public abstract init(): Promise<void>;

  public abstract getName(): string;
}
