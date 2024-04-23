import { ethers } from 'hardhat';
import {
  HistoricDataFeedGenericConsumer,
  HistoricDataFeedStoreGenericV1,
  HistoricDataFeedStoreV1,
  HistoricDataFeedStoreV3,
  IDataFeedStore__factory,
} from '../typechain';
import { expect } from 'chai';
import { contractVersionLogger } from './utils/logger';
import {
  GenericHistoricDataFeedStore,
  HistoricDataFeedStore,
  deployContract,
  printGasUsage,
  setDataFeeds,
  setter,
} from './utils/helpers/common';
import { HistoricDataFeedStoreV2 } from '../typechain/contracts/HistoricDataFeedStoreV2';
import { HistoricDataFeedConsumer } from '../typechain/contracts/test/consumers/historic/HistoricDataFeedConsumer';
import { HistoricConsumer } from '../typechain/contracts/test/consumers/historic/Consumer.sol';

const selector =
  IDataFeedStore__factory.createInterface().getFunction('setFeeds').selector;
const contracts: {
  [key: string]: HistoricDataFeedStore;
} = {};
const genericContracts: {
  [key: string]: GenericHistoricDataFeedStore;
} = {};
const consumers: {
  [key: string]: HistoricConsumer;
} = {};
const genericConsumers: {
  [key: string]: HistoricDataFeedGenericConsumer;
} = {};

describe('HistoricDataFeedConsumer', function () {
  this.timeout(100000);

  let logger: ReturnType<typeof contractVersionLogger>;

  beforeEach(async function () {
    genericContracts.V1 = await deployContract<HistoricDataFeedStoreGenericV1>(
      'HistoricDataFeedStoreGenericV1',
    );

    genericConsumers.V1 = await deployContract<HistoricDataFeedGenericConsumer>(
      'HistoricDataFeedGenericConsumer',
      genericContracts.V1.target,
    );

    contracts.V4 = await deployContract<HistoricDataFeedStoreV1>(
      'HistoricDataFeedStoreV1',
    );
    contracts.V5 = await deployContract<HistoricDataFeedStoreV2>(
      'HistoricDataFeedStoreV2',
    );
    contracts.V6 = await deployContract<HistoricDataFeedStoreV3>(
      'HistoricDataFeedStoreV3',
    );

    consumers.V4 = await deployContract<HistoricDataFeedConsumer>(
      'HistoricDataFeedConsumer',
      contracts.V4.target,
    );
    consumers.V5 = await deployContract<HistoricDataFeedConsumer>(
      'HistoricDataFeedConsumer',
      contracts.V5.target,
    );
    consumers.V6 = await deployContract<HistoricDataFeedConsumer>(
      'HistoricDataFeedConsumer',
      contracts.V6.target,
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
      let contract: any;
      let consumer: HistoricConsumer;

      beforeEach(async function () {
        const keys = Object.keys(contracts);
        contract = contracts[keys[i]];
        consumer = consumers[keys[i]];
      });

      it('Should read the latest data feed and counter with the fallback function', async function () {
        const key = 3;
        const value = ethers.solidityPacked(
          ['bytes32'],
          [ethers.encodeBytes32String('Hello, World!')],
        );
        const receipt = await setter(contract, selector, [key], [value]);

        await consumer.setMultipleLatestFeedsById([key]);
        const data = await consumer.latestDataFeeds(key);
        expect(data[0]).to.equal(value.slice(0, 50));
        expect(data[1]).to.equal(
          (await ethers.provider.getBlock(receipt.blockNumber))?.timestamp,
        );
      });

      it('Should set the latest data feed with the fallback function', async function () {
        const key = 3;
        const value = ethers.solidityPacked(
          ['bytes32'],
          [ethers.encodeBytes32String('Hello, World!')],
        );
        const receipt = await setter(contract, selector, [key], [value]);

        await consumer.setMultipleFetchedLatestFeedsById([key]);
        const data = await consumer.getFeedById(key);
        expect(data[0]).to.equal(value.slice(0, 50));
        expect(data[1]).to.equal(
          (await ethers.provider.getBlock(receipt.blockNumber))?.timestamp,
        );

        const counter = await consumer.counters(key);
        expect(counter).to.equal(1);
      });

      it('Should read the historic data feed and counter with the fallback function', async function () {
        const key = 3;
        const counter = 1;
        const value = ethers.solidityPacked(
          ['bytes32'],
          [ethers.encodeBytes32String('Hello, World!')],
        );
        const receipt = await setter(contract, selector, [key], [value]);

        await consumer.setMultipleFeedsAtCounter([key], [counter]);
        const data = await consumer.getFeedAtCounter(key, counter);
        expect(data[0]).to.equal(value.slice(0, 50));
        expect(data[1]).to.equal(
          (await ethers.provider.getBlock(receipt.blockNumber))?.timestamp,
        );
      });
    });
  }

  for (let i = 1; i <= 100; i *= 10) {
    it(`Should update ${i} feeds and counters in a single transaction`, async function () {
      await setDataFeeds(
        Object.values(genericContracts),
        Object.values(contracts),
        selector,
        i,
      );
      const {
        receipts: setReceipts,
        receiptsGeneric: setReceiptsGeneric,
        keys,
        values,
      } = await setDataFeeds(
        Object.values(genericContracts),
        Object.values(contracts),
        selector,
        i,
      );

      const receipts = [];
      for (const [index, consumer] of Object.values(consumers).entries()) {
        const receipt = await consumer.setMultipleFetchedLatestFeedsById(keys);
        receipts.push(await receipt.wait());

        for (const [i, key] of keys.entries()) {
          const data = await consumer.getFeedById(key);
          expect(data[0]).to.equal(values[i].slice(0, 50));
          expect(data[1]).to.equal(
            (
              await ethers.provider.getBlock(
                setReceipts[index].blockNumber || 0,
              )
            )?.timestamp,
          );

          const counter = await consumer.counters(key);
          expect(counter).to.equal(2);
        }
      }

      let receiptsGeneric = [];
      for (const consumer of Object.values(genericConsumers)) {
        const receipt = await consumer.setMultipleFetchedLatestFeedsById(keys);

        for (const [i, key] of keys.entries()) {
          const data = await consumer.getFeedById(key);
          expect(data[0]).to.equal(values[i].slice(0, 50));
          expect(data[1]).to.equal(
            (
              await ethers.provider.getBlock(
                setReceiptsGeneric[0]?.blockNumber || 0,
              )
            )?.timestamp,
          );

          const counter = await consumer.counters(key);
          expect(counter).to.equal(2);
        }

        receiptsGeneric.push(await receipt.wait());
      }

      printGasUsage(logger, receipts, receiptsGeneric);

      for (const receipt of receipts) {
        for (const genericReceipt of receiptsGeneric) {
          expect(receipt?.gasUsed).to.be.lte(genericReceipt?.gasUsed);
        }
      }
    });
  }
});
