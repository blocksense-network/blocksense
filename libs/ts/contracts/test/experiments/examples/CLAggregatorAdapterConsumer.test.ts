import { artifacts, ethers } from 'hardhat';
import { CLAggregatorAdapterConsumer } from '../../../typechain';
import { deployContract } from '../utils/helpers/common';
import {
  CLV2Wrapper,
  UpgradeableProxyHistoricalDataFeedStoreV2Wrapper,
} from '../utils/wrappers';
import * as utils from '../../examples/utils/clAggregatorAdapterConsumer';
import { expect } from 'chai';

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

  [
    { title: 'get decimals', fnName: 'getDecimals' },
    { title: 'get description', fnName: 'getDescription' },
    { title: 'get latest answer', fnName: 'getLatestAnswer' },
    { title: 'get latest round', fnName: 'getLatestRound' },
    { title: 'get latest round data', fnName: 'getLatestRoundData' },
  ].forEach(data => {
    it('Should ' + data.title, async function () {
      await getAndCompareData([], data.fnName as keyof typeof utils);
    });
  });

  it('Should get round data', async function () {
    await getAndCompareData([1], 'getRoundData');
  });

  const getAndCompareData = async (
    data: any[],
    functionName: keyof typeof utils,
  ) => {
    const contractData = await clAggregatorAdapterConsumer.getFunction(
      functionName,
    )(...data);

    const config = {
      address: clAggregatorAdapter.contract.target,
      abiJson: (await artifacts.readArtifact('CLAggregatorAdapterExp')).abi,
      provider: clAggregatorAdapter.contract.runner!,
    };
    const utilData = await utils[functionName](config, ...data);

    expect(contractData).to.deep.equal(utilData);
  };
});
