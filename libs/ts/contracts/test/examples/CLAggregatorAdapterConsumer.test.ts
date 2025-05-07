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
import {
  functions,
  AggregatorConfig,
} from './utils/clAggregatorAdapterConsumer';

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
    { title: 'get decimals', fnName: 'getDecimals' } as const,
    { title: 'get description', fnName: 'getDescription' } as const,
    { title: 'get latest answer', fnName: 'getLatestAnswer' } as const,
    { title: 'get latest round', fnName: 'getLatestRound' } as const,
    { title: 'get latest round data', fnName: 'getLatestRoundData' } as const,
  ].forEach(data => {
    it('Should ' + data.title, async function () {
      await getAndCompareData(data.fnName, []);
    });
  });

  it('Should get round data', async function () {
    await getAndCompareData('getRoundData', [1]);
  });

  type Functions = typeof functions;
  type FunctionName = keyof Functions;

  async function getAndCompareData<F extends FunctionName>(
    functionName: F,
    data: number[],
  ) {
    const contractData = await clAggregatorAdapterConsumer.getFunction(
      functionName,
    )(...data);

    const config = {
      address: clAggregatorAdapter.contract.target,
      abiJson: (await artifacts.readArtifact('CLAggregatorAdapter')).abi,
      provider: clAggregatorAdapter.contract.runner!,
    };
    const utilData = await functions[functionName](config, ...data);

    expect(contractData).to.deep.equal(utilData);
  }
});
