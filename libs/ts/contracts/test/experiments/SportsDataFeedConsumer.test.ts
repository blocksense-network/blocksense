import { SportsConsumer, SportsGenericConsumer } from '../../typechain';
import { initWrappers } from './utils/helpers/common';
import { compareSportsConsumerGasUsed } from './utils/helpers/sportsConsumerGasHelpers';
import {
  SportsDataFeedStoreConsumerBaseWrapper,
  SportsDataFeedStoreConsumerV1Wrapper,
  SportsDataFeedStoreConsumerV2Wrapper,
  SportsDataFeedStoreGenericConsumerV1Wrapper,
  SportsDataFeedStoreGenericConsumerV2Wrapper,
} from './utils/wrappers';

let contractWrappers: SportsDataFeedStoreConsumerBaseWrapper<SportsConsumer>[] =
  [];
let genericContractWrappers: SportsDataFeedStoreConsumerBaseWrapper<SportsGenericConsumer>[] =
  [];

describe('SportsDataFeedConsumer', function () {
  beforeEach(async function () {
    contractWrappers = [];
    genericContractWrappers = [];

    await initWrappers(contractWrappers, [
      SportsDataFeedStoreConsumerV1Wrapper,
      SportsDataFeedStoreConsumerV2Wrapper,
    ]);

    await initWrappers(genericContractWrappers, [
      SportsDataFeedStoreGenericConsumerV1Wrapper,
      SportsDataFeedStoreGenericConsumerV2Wrapper,
    ]);
  });

  it('Should compare gas when decoding basketball data', async function () {
    await compareSportsConsumerGasUsed(
      genericContractWrappers,
      contractWrappers,
      ['basketball'],
    );
  });

  it('Should compare gas when decoding football data', async function () {
    await compareSportsConsumerGasUsed(
      genericContractWrappers,
      contractWrappers,
      ['football'],
    );
  });
});
