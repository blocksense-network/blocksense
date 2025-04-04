import { artifacts, ethers } from 'hardhat';

import * as utils from './utils/clAggregatorAdapterConsumer';
import { expect } from 'chai';
import { deployContract } from '../experiments/utils/helpers/common';
import { CLAggregatorAdapterConsumer } from '../../typechain';
import {
  CLAdapterWrapper,
  UpgradeableProxyADFSWrapper,
} from '../utils/wrappers';
import { encodeDataAndTimestamp } from '../utils/helpers/common';

describe('Example: CLAggregatorAdapterConsumer', function () {
  let clAggregatorAdapter: CLAdapterWrapper;
  let clAggregatorAdapterConsumer: CLAggregatorAdapterConsumer;

  beforeEach(async function () {
    const admin = (await ethers.getSigners())[9];
    const sequencer = (await ethers.getSigners())[10];
    const accessControlAdmin = (await ethers.getSigners())[5];

    const proxy = new UpgradeableProxyADFSWrapper();
    await proxy.init(admin, accessControlAdmin);

    await proxy.implementation.accessControl.setAdminStates(
      accessControlAdmin,
      [sequencer.address],
      [true],
    );

    clAggregatorAdapter = new CLAdapterWrapper();
    await clAggregatorAdapter.init('ETH/USD', 8, 3, proxy);

    const value = encodeDataAndTimestamp(1234, Date.now());
    await clAggregatorAdapter.setFeed(sequencer, value, 1n);

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
      abiJson: (await artifacts.readArtifact('CLAggregatorAdapter')).abi,
      provider: clAggregatorAdapter.contract.runner!,
    };
    const utilData = await utils[functionName](config, ...data);

    expect(contractData).to.deep.equal(utilData);
  };
});
