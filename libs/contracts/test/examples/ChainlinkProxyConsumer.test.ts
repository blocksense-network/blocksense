import { artifacts, ethers } from 'hardhat';
import { ChainlinkProxyConsumer } from '../../typechain';
import { deployContract } from '../utils/helpers/common';
import {
  ChainlinkV2Wrapper,
  UpgradeableProxyHistoricDataFeedStoreV2Wrapper,
} from '../utils/wrappers';
import * as utils from './utils/chainlinkProxyConsumer';
import { expect } from 'chai';

describe('Example: ChainlinkProxyConsumer', function () {
  let chainlinkProxy: ChainlinkV2Wrapper;
  let chainlinkProxyConsumer: ChainlinkProxyConsumer;

  beforeEach(async function () {
    const admin = (await ethers.getSigners())[5];

    const proxy = new UpgradeableProxyHistoricDataFeedStoreV2Wrapper();
    await proxy.init(admin);

    chainlinkProxy = new ChainlinkV2Wrapper();

    await chainlinkProxy.init('ETH/USD', 8, 3, proxy);

    const value = ethers.encodeBytes32String('1234');
    await chainlinkProxy.setFeed(value);

    const owner = (await ethers.getSigners())[2];

    chainlinkProxyConsumer = await deployContract<ChainlinkProxyConsumer>(
      'ChainlinkProxyConsumer',
      chainlinkProxy.contract.target,
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
    const contractData = await chainlinkProxyConsumer.getFunction(functionName)(
      ...data,
    );

    const config = {
      address: chainlinkProxy.contract.target,
      abiJson: (await artifacts.readArtifact('ChainlinkProxy')).abi,
      provider: chainlinkProxy.contract.runner!,
    };
    const utilData = await utils[functionName](config, ...data);

    expect(contractData).to.deep.equal(utilData);
  };
});
