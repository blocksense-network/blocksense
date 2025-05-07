import { artifacts, ethers } from 'hardhat';
import { CLAggregatorAdapterConsumer } from '../../../typechain';
import { deployContract } from '../utils/helpers/common';
import {
  CLV2Wrapper,
  UpgradeableProxyHistoricalDataFeedStoreV2Wrapper,
} from '../utils/wrappers';
import * as utils from '../../examples/utils/clAggregatorAdapterConsumer';
import { expect } from 'chai';
import {
  AggregatorConfig,
  functions,
} from '../../examples/utils/clAggregatorAdapterConsumer';

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
      abiJson: (await artifacts.readArtifact('CLAggregatorAdapterExp')).abi,
      provider: clAggregatorAdapter.contract.runner!,
    };
    const utilData = await functions[functionName](config, ...(data as any));

    expect(contractData).to.deep.equal(utilData);
  }
});
