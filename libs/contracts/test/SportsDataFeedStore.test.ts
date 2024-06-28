import {
  SportsDataFeedStoreGenericV1,
  SportsDataFeedStoreGenericV2,
  SportsDataFeedStoreV1,
  SportsDataFeedStoreV2,
} from '../typechain';
import {
  SportsDataFeedStoreBaseWrapper,
  SportsDataFeedStoreGenericV1Wrapper,
  SportsDataFeedStoreGenericV2Wrapper,
  SportsDataFeedStoreV1Wrapper,
  SportsDataFeedStoreV2Wrapper,
} from './utils/wrappers';
import { initWrappers } from './utils/helpers/common';
import { compareGasUsed } from './utils/helpers/sportsDataFeedGasHelpers';

let contractWrappers: SportsDataFeedStoreBaseWrapper<
  SportsDataFeedStoreV1 | SportsDataFeedStoreV2
>[] = [];
let genericContractWrappers: SportsDataFeedStoreBaseWrapper<
  SportsDataFeedStoreGenericV1 | SportsDataFeedStoreGenericV2
>[] = [];

describe('SportsDataFeedStore', () => {
  beforeEach(async () => {
    await initWrappers(contractWrappers, [
      SportsDataFeedStoreV1Wrapper,
      SportsDataFeedStoreV2Wrapper,
    ]);

    await initWrappers(genericContractWrappers, [
      SportsDataFeedStoreGenericV1Wrapper,
      SportsDataFeedStoreGenericV2Wrapper,
    ]);
  });

  it('Should set data correctly', async () => {
    await compareGasUsed(
      genericContractWrappers,
      contractWrappers,
      [2, 3],
      123,
    );
  });
});
