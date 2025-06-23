import { artifacts, ethers } from 'hardhat';
import { Addressable, ContractRunner } from 'ethers';
type EthersContractParams = [
  address: string | Addressable,
  abiJson: any,
  provider: ContractRunner,
];
import {
  BlocksenseFeedStoreConsumer,
  RawCallFeedStoreConsumer,
} from '@blocksense/contracts/typechain';
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

  type Functions = typeof utils;
  type FunctionName = keyof Functions;
  type FunctionParameters<F extends FunctionName> =
    Parameters<Functions[F]> extends [EthersContractParams, ...infer Rest]
      ? Rest extends [key: number, ...unknown[]]
        ? Rest
        : never
      : never;

  (
    [
      { title: 'get latest answer', fnName: 'getLatestAnswer' },
      { title: 'get latest round', fnName: 'getLatestRound' },
      { title: 'get latest round data', fnName: 'getLatestRoundData' },
    ] satisfies { title: string; fnName: FunctionName }[]
  ).forEach(({ title, fnName }) => {
    it('Should ' + title, async function () {
      await getAndCompareData([key], fnName);
    });
  });

  it('Should get round data', async function () {
    await getAndCompareData([key, 1], 'getRoundData');
  });

  const getAndCompareData = async <F extends FunctionName>(
    data: FunctionParameters<F>,
    functionName: F,
  ) => {
    const blocksenseData = await blocksenseFeedStoreConsumer.getFunction(
      functionName,
    )(...data);
    const rawCallData = await rawCallFeedStoreConsumer.getFunction(
      functionName,
    )(...data);

    const config: EthersContractParams = [
      dataFeedStore.contract.target,
      (await artifacts.readArtifact('HistoricalDataFeedStoreV2')).abi,
      dataFeedStore.contract.runner!,
    ];
    const func = utils[functionName] as (
      config: EthersContractParams,
      ...args: FunctionParameters<F>
    ) => Promise<any>;
    const utilData = await func(config, ...data);

    expect(blocksenseData).to.deep.equal(utilData);
    expect(rawCallData).to.deep.equal(utilData);
  };
});
