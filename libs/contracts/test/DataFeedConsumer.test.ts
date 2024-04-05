import { ethers } from 'hardhat';
import { DataFeedStoreGenericV1, IDataFeedStore__factory } from '../typechain';
import { expect } from 'chai';
import { contractVersionLogger } from './utils/logger';
import {
  DataFeedStore,
  GenericDataFeedStore,
  deployContract,
  setter,
} from './utils/helpers/common';
import {
  DataFeedConsumer,
  GenericDataFeedConsumer,
  compareConsumerGasUsed,
} from './utils/helpers/consumerGasHelpers';

const selector =
  IDataFeedStore__factory.createInterface().getFunction('setFeeds').selector;
const contracts: {
  [key: string]: DataFeedStore;
} = {};
const genericContracts: {
  [key: string]: GenericDataFeedStore;
} = {};
const consumers: {
  [key: string]: DataFeedConsumer;
} = {};
const genericConsumers: {
  [key: string]: GenericDataFeedConsumer;
} = {};

describe('DataFeedConsumer', function () {
  this.timeout(100000);

  let logger: ReturnType<typeof contractVersionLogger>;

  beforeEach(async function () {
    genericContracts.V1 = await deployContract<DataFeedStoreGenericV1>(
      'DataFeedStoreGenericV1',
    );
    genericContracts.V2 = await deployContract<DataFeedStoreGenericV1>(
      'DataFeedStoreGenericV2',
    );

    genericConsumers.V1 = await deployContract<GenericDataFeedConsumer>(
      'DataFeedGenericConsumer',
      genericContracts.V1.target,
    );
    genericConsumers.V2 = await deployContract<GenericDataFeedConsumer>(
      'DataFeedGenericV2Consumer',
      genericContracts.V2,
    );

    contracts.V1 = await deployContract<DataFeedStore>('DataFeedStoreV1');
    contracts.V2 = await deployContract<DataFeedStore>('DataFeedStoreV2');
    contracts.V3 = await deployContract<DataFeedStore>('DataFeedStoreV3');

    consumers.V1 = await deployContract<DataFeedConsumer>(
      'DataFeedV1Consumer',
      contracts.V1.target,
    );
    consumers.V2 = await deployContract<DataFeedConsumer>(
      'DataFeedV2Consumer',
      contracts.V2.target,
    );
    consumers.V3 = await deployContract<DataFeedConsumer>(
      'DataFeedV2Consumer',
      contracts.V3.target,
    );

    logger = contractVersionLogger([
      contracts,
      consumers,
      genericContracts,
      genericConsumers,
    ]);
  });

  for (let i = 0; i < 3; i++) {
    describe(`DataFeedStoreV${i + 1}`, function () {
      let contract: DataFeedStore;
      let consumer: DataFeedConsumer;

      beforeEach(async function () {
        const keys = Object.keys(contracts);
        contract = contracts[keys[i]];
        consumer = consumers[keys[i]];
      });

      it('Should read the data feed with the fallback function', async function () {
        const key = 3;
        const value = ethers.solidityPacked(
          ['bytes32'],
          [ethers.zeroPadBytes(ethers.toUtf8Bytes('Hello, World!'), 32)],
        );
        await setter(contract, selector, [key], [value]);

        const feed = await consumer.getExternalFeedById(key);
        expect(feed).to.equal(value);
      });
    });
  }

  for (let i = 1; i <= 1000; i *= 10) {
    it(`Should fetch and set ${i} feeds in a single transaction`, async function () {
      await compareConsumerGasUsed(
        logger,
        Object.values(genericConsumers),
        Object.values(consumers),
        Object.values(genericContracts),
        Object.values(contracts),
        selector,
        i,
      );
    });
  }
});
