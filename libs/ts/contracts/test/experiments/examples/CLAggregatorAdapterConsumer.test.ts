import { ethers } from 'hardhat';
import { CLAggregatorAdapterConsumer } from '@blocksense/contracts/typechain';
import { deployContract } from '../utils/helpers/common';
import {
  CLV2Wrapper,
  UpgradeableProxyHistoricalDataFeedStoreV2Wrapper,
} from '../utils/wrappers';

describe('[Experiments] Example: CLAggregatorAdapterConsumer', function () {
  let clAggregatorAdapter: CLV2Wrapper;
  let clAggregatorAdapterConsumer: CLAggregatorAdapterConsumer;

  beforeEach(async function () {
    const admin = (await ethers.getSigners())[5];

    const proxy = new UpgradeableProxyHistoricalDataFeedStoreV2Wrapper();
    await proxy.init(admin);

    clAggregatorAdapter = new CLV2Wrapper();

    await clAggregatorAdapter.init('ETH/USD', 8, 3, proxy);

    const value = ethers.encodeBytes32String('1234');
    await clAggregatorAdapter.setFeed(value);

    clAggregatorAdapterConsumer =
      await deployContract<CLAggregatorAdapterConsumer>(
        'CLAggregatorAdapterConsumer',
        clAggregatorAdapter.contract.target,
      );
  });

  it('Should compare results from adapter with those from adapter consumer', async function () {
    await clAggregatorAdapter.checkDecimals(
      Number(await clAggregatorAdapterConsumer.getDecimals()),
    );
    await clAggregatorAdapter.checkDescription(
      await clAggregatorAdapterConsumer.getDescription(),
    );
    await clAggregatorAdapter.checkLatestAnswer(
      await clAggregatorAdapterConsumer.getLatestAnswer(),
    );
    await clAggregatorAdapter.checkLatestRoundId(
      Number(await clAggregatorAdapterConsumer.getLatestRound()),
    );
    const roundData = await clAggregatorAdapterConsumer.getRoundData(1);
    await clAggregatorAdapter.checkLatestRoundData({
      roundId: roundData.roundId_,
      answer: roundData.answer,
      startedAt: Number(roundData.startedAt),
    });
  });
});
