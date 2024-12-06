import { BaseContract } from 'ethers';
import { SportsConsumer } from '../../../../../../typechain';
import { ISportsWrapper } from '../../../../utils/wrappers/interfaces/ISportsWrapper';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { ISportsConsumerWrapper } from '../../../../utils/wrappers/interfaces/ISportsConsumerWrapper';

export abstract class SportsDataFeedStoreConsumerBaseWrapper<
  U extends BaseContract,
> implements ISportsConsumerWrapper<SportsConsumer, U>
{
  public contract!: SportsConsumer;
  public wrapper!: ISportsWrapper<U>;

  public async setFeeds(
    keys: number[],
    values: string[],
    descriptions: string[],
    ...args: any[]
  ): Promise<any> {
    return this.wrapper.setFeeds(keys, values, descriptions, ...args);
  }

  public async decodeData(type: 'basketball' | 'football', key: number) {
    const functionName =
      type === 'basketball' ? 'decodeBasketballData' : 'decodeFootballData';
    const data = await this.contract[functionName].staticCall(key);
    const tx = await this.contract[functionName](key);
    const receipt = await tx.wait();

    return { data, receipt };
  }

  public async checkSetValues(
    keys: number[],
    values: string[],
    types: ('basketball' | 'football')[],
  ): Promise<void> {
    for (let i = 0; i < keys.length; i++) {
      const parsedValues = values[i].split(';');

      const { data } = await this.decodeData(types[i], keys[i]);

      const dataTypes = Object.keys(data).map(() => 'uint32');
      const dataValues = Object.values(data);

      for (const parsedValue of parsedValues) {
        let packedValue = ethers.solidityPacked(
          dataTypes.splice(0, 8),
          dataValues.splice(0, 8),
        );
        packedValue = '0x' + packedValue.slice(2).padEnd(64, '0');
        expect(packedValue).to.equal(parsedValue);
      }
    }

    await this.wrapper.checkSetValues(keys, values);
  }

  public abstract init(): Promise<void>;

  public abstract getName(): string;
}
