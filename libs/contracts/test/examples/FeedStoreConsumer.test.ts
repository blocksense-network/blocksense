import { artifacts, ethers } from 'hardhat';
import {
  ProxyCallFeedStoreConsumer,
  RawCallFeedStoreConsumer,
} from '../../typechain';
import { deployContract } from '../utils/helpers/common';
import { HistoricDataFeedStoreV2Wrapper } from '../utils/wrappers';
import * as utils from './utils/feedStoreConsumer';
import { expect } from 'chai';

describe('Example: FeedStoreConsumer', function () {
  let dataFeedStore: HistoricDataFeedStoreV2Wrapper;
  let proxyCallFeedStoreConsumer: ProxyCallFeedStoreConsumer;
  let rawCallFeedStoreConsumer: RawCallFeedStoreConsumer;
  const key = 1;

  beforeEach(async function () {
    dataFeedStore = new HistoricDataFeedStoreV2Wrapper();
    await dataFeedStore.init();

    const value = ethers.encodeBytes32String('value');

    await dataFeedStore.setFeeds([key], [value]);

    proxyCallFeedStoreConsumer =
      await deployContract<ProxyCallFeedStoreConsumer>(
        'ProxyCallFeedStoreConsumer',
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
    const proxyCallData = await proxyCallFeedStoreConsumer.getFunction(
      functionName,
    )(...data);
    const rawCallData = await rawCallFeedStoreConsumer.getFunction(
      functionName,
    )(...data);

    const config = {
      address: dataFeedStore.contract.target,
      abiJson: (await artifacts.readArtifact('HistoricDataFeedStoreV2')).abi,
      provider: dataFeedStore.contract.runner!,
    };
    const utilData = await utils[functionName](config, ...data);

    expect(proxyCallData).to.deep.equal(utilData);
    expect(rawCallData).to.deep.equal(utilData);
  };
});
