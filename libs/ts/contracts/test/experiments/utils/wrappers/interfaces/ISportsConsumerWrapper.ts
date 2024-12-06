import { BaseContract } from 'ethers';
import { IWrapper } from '..';

export interface ISportsConsumerWrapper<
  T extends BaseContract,
  W extends BaseContract,
> extends IWrapper<T> {
  wrapper: IWrapper<W>;

  decodeData(
    type: 'basketball' | 'football',
    key: number,
  ): Promise<{
    data: any;
    receipt: any;
  }>;
}
