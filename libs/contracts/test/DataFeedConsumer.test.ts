import { ethers, network } from 'hardhat';
import {
  IDataFeedStore,
  DataFeedV1Consumer,
  DataFeedV2Consumer,
  DataFeedGenericConsumer,
  DataFeedStoreGeneric,
  DataFeedGenericV2Consumer,
  DataFeedStoreGenericV2,
  IDataFeedStore__factory,
} from '../typechain';
import { expect } from 'chai';
import { contractVersionLogger } from './uitls/logger';
import { DataFeedStore, GenericDataFeedStore, setter } from './uitls/helpers';
import {
  DataFeedConsumers,
  DataFeedGenericConsumers,
  compareConsumerGasUsed,
} from './uitls/helpers/consumerGasHelpers';

const selector =
  IDataFeedStore__factory.createInterface().getFunction('setFeeds').selector;
const contracts: {
  [key: string]: DataFeedStore;
} = {};
const genericContracts: {
  [key: string]: GenericDataFeedStore;
} = {};
const consumers: {
  [key: string]: DataFeedConsumers;
} = {};
const genericConsumers: {
  [key: string]: DataFeedGenericConsumers;
} = {};

describe('DataFeedConsumer', function () {
  let logger: ReturnType<typeof contractVersionLogger>;

  beforeEach(async function () {
    const DataFeedStoreGeneric = await ethers.getContractFactory(
      'DataFeedStoreGeneric',
    );
    genericContracts.V1 = await (
      await DataFeedStoreGeneric.deploy()
    ).waitForDeployment();

    const DataFeedStoreGenericV2 = await ethers.getContractFactory(
      'DataFeedStoreGenericV2',
    );
    genericContracts.V2 = await (
      await DataFeedStoreGenericV2.deploy()
    ).waitForDeployment();

    const DataFeedGenericConsumer = await ethers.getContractFactory(
      'DataFeedGenericConsumer',
    );
    genericConsumers.V1 = await (
      await DataFeedGenericConsumer.deploy(
        await genericContracts.V1.getAddress(),
      )
    ).waitForDeployment();

    const DataFeedGenericV2Consumer = await ethers.getContractFactory(
      'DataFeedGenericV2Consumer',
    );
    genericConsumers.V2 = await (
      await DataFeedGenericV2Consumer.deploy(
        await genericContracts.V2.getAddress(),
      )
    ).waitForDeployment();

    const DataFeedStore = await ethers.getContractFactory('DataFeedStoreV1');
    contracts.V1 = await (await DataFeedStore.deploy()).waitForDeployment();

    const DataFeedV1Consumer =
      await ethers.getContractFactory('DataFeedV1Consumer');
    consumers.V1 = await (
      await DataFeedV1Consumer.deploy(await contracts.V1.getAddress())
    ).waitForDeployment();

    const DataFeedStoreV2 = await ethers.getContractFactory(`DataFeedStoreV2`);
    contracts.V2 = await (await DataFeedStoreV2.deploy()).waitForDeployment();

    const DataFeedV2Consumer =
      await ethers.getContractFactory('DataFeedV2Consumer');
    consumers.V2 = await (
      await DataFeedV2Consumer.deploy(await contracts.V2.getAddress())
    ).waitForDeployment();

    const DataFeedStoreV3 = await ethers.getContractFactory(`DataFeedStoreV3`);
    contracts.V3 = await (await DataFeedStoreV3.deploy()).waitForDeployment();

    consumers.V3 = await (
      await DataFeedV2Consumer.deploy(await contracts.V3.getAddress())
    ).waitForDeployment();

    logger = contractVersionLogger(consumers);
  });

  for (let i = 0; i < 3; i++) {
    describe(`DataFeedStoreV${i + 1}`, function () {
      let contract: DataFeedStore;
      let consumer: DataFeedConsumers;

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

  it('Should get the value from the DataFeedStore and store it in the contract', async function () {
    await compareConsumerGasUsed(
      logger,
      Object.values(genericConsumers),
      Object.values(consumers),
      Object.values(genericContracts),
      Object.values(contracts),
      selector,
      1,
      3,
    );
  });

  it('Should fetch and set 10 feeds in a single transaction', async function () {
    await compareConsumerGasUsed(
      logger,
      Object.values(genericConsumers),
      Object.values(consumers),
      Object.values(genericContracts),
      Object.values(contracts),
      selector,
      10,
    );
  });

  it('Should fetch and set 100 feeds in a single transaction', async function () {
    await compareConsumerGasUsed(
      logger,
      Object.values(genericConsumers),
      Object.values(consumers),
      Object.values(genericContracts),
      Object.values(contracts),
      selector,
      100,
    );
  });

  it('Should fetch and set 255 feeds in a single transaction', async function () {
    await compareConsumerGasUsed(
      logger,
      Object.values(genericConsumers),
      Object.values(consumers),
      Object.values(genericContracts),
      Object.values(contracts),
      selector,
      255,
    );
  });
});
