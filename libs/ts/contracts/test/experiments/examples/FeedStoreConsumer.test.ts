import { artifacts, ethers } from 'hardhat';
import {
  BlocksenseFeedStoreConsumer,
  RawCallFeedStoreConsumer,
} from '../../../typechain';
import { deployContract } from '../utils/helpers/common';
import { HistoricalDataFeedStoreV2Wrapper } from '../utils/wrappers';
import * as utils from './utils/feedStoreConsumer';
import { expect } from 'chai';

describe('[Experiments] Example: FeedStoreConsumer', function () {
  let dataFeedStore: HistoricalDataFeedStoreV2Wrapper;
  let blocksenseFeedStoreConsumer: BlocksenseFeedStoreConsumer;
  let rawCallFeedStoreConsumer: RawCallFeedStoreConsumer;
  const key = 1;

  beforeEach(async function () {
    dataFeedStore = new HistoricalDataFeedStoreV2Wrapper();
    await dataFeedStore.init();

    const value = ethers.encodeBytes32String('value');

    await dataFeedStore.setFeeds([key], [value]);

    blocksenseFeedStoreConsumer =
      await deployContract<BlocksenseFeedStoreConsumer>(
        'BlocksenseFeedStoreConsumer',
        dataFeedStore.contract.target,
      );
    rawCallFeedStoreConsumer = await deployContract<RawCallFeedStoreConsumer>(
      'RawCallFeedStoreConsumer',
      dataFeedStore.contract.target,
    );
  });

  [
    { title: 'get latest answer', fnName: 'getLatestAnswer' },
    { title: 'get latest round', fnName: 'getLatestRound' },
    { title: 'get latest round data', fnName: 'getLatestRoundData' },
  ].forEach(data => {
    it('Should ' + data.title, async function () {
      await getAndCompareData([key], data.fnName as keyof typeof utils);
    });
  });

  it('Should get round data', async function () {
    await getAndCompareData([key, 1], 'getRoundData');
  });

  const getAndCompareData = async (
    data: any[],
    functionName: keyof typeof utils,
  ) => {
    const blocksenseData = await blocksenseFeedStoreConsumer.getFunction(
      functionName,
    )(...data);
    const rawCallData = await rawCallFeedStoreConsumer.getFunction(
      functionName,
    )(...data);

    const config = {
      address: dataFeedStore.contract.target,
      abiJson: (await artifacts.readArtifact('HistoricalDataFeedStoreV2')).abi,
      provider: dataFeedStore.contract.runner!,
    };
    const utilData = await utils[functionName](config, ...data);

    expect(blocksenseData).to.deep.equal(utilData);
    expect(rawCallData).to.deep.equal(utilData);
  };
});
