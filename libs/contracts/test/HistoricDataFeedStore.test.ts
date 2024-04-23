import { ethers } from 'hardhat';
import {
  HistoricDataFeedStoreGenericV1,
  HistoricDataFeedStoreV1,
  HistoricDataFeedStoreV3,
  IDataFeedStore__factory,
} from '../typechain';
import {
  HISTORIC_SELECTORS,
  deployContract,
  getHistoricSelector,
  getter,
  printGasUsage,
  setDataFeeds,
  setter,
} from './utils/helpers/common';
import { expect } from 'chai';
import { contractVersionLogger } from './utils/logger';
import { HistoricDataFeedStoreV2 } from '../typechain/contracts/HistoricDataFeedStoreV2';

const contracts: {
  [key: string]: any;
} = {};
const genericContracts: {
  [key: string]: any;
} = {};
const selector =
  IDataFeedStore__factory.createInterface().getFunction('setFeeds').selector;

describe('HistoricDataFeedStore', function () {
  let logger: ReturnType<typeof contractVersionLogger>;

  beforeEach(async function () {
    genericContracts.V1 = await deployContract<HistoricDataFeedStoreGenericV1>(
      'HistoricDataFeedStoreGenericV1',
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

    logger = contractVersionLogger([contracts, genericContracts]);
  });

  for (let i = 4; i <= 6; i++) {
    it('Should set and get correct values', async function () {
      const key = 1;
      const value = ethers.encodeBytes32String('value');

      const receipt = await setter(
        contracts[`V${i}`],
        selector,
        [key],
        [value],
      );
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      const storedValue = await getter(
        contracts[`V${i}`],
        getHistoricSelector(HISTORIC_SELECTORS.GET_LATEST_VALUE, key),
      );

      const data = storedValue.slice(0, 48).padEnd(66, '0');
      const timestamp = ethers.toNumber(
        '0x' + storedValue.slice(48, storedValue.length),
      );

      expect(data).to.equal(value);
      expect(timestamp).to.equal(block?.timestamp);
    });

    it('Should get the current counter', async function () {
      const key = 1;
      const value = ethers.encodeBytes32String('value');

      await setter(contracts[`V${i}`], selector, [key], [value]);
      const historicSelector = getHistoricSelector(
        HISTORIC_SELECTORS.GET_LATEST_COUNTER,
        key,
      );
      const counter = await getter(contracts[`V${i}`], historicSelector);

      expect(+counter).to.equal(1);
    });

    it('Should get the current counter after 10 iterations', async function () {
      const key = 1;
      const value = ethers.encodeBytes32String('value');

      for (let j = 0; j < 10; j++) {
        await setter(contracts[`V${i}`], selector, [key], [value]);
      }
      const historicSelector = getHistoricSelector(
        HISTORIC_SELECTORS.GET_LATEST_COUNTER,
        key,
      );
      const counter = await getter(contracts[`V${i}`], historicSelector);

      expect(+counter).to.equal(10);
    });

    it('Should get value at counter 5', async function () {
      const key = 1;
      let timestamp = 0;

      for (let j = 1; j <= 10; j++) {
        const value = ethers.encodeBytes32String('value ' + j);
        await setter(contracts[`V${i}`], selector, [key], [value]);
        if (j === 5) {
          timestamp =
            (await ethers.provider.getBlock('latest'))?.timestamp || 0;
        }
      }
      const historicSelector = getHistoricSelector(
        HISTORIC_SELECTORS.GET_VALUE_AT_COUNTER,
        key,
      );
      const data = await getter(contracts[`V${i}`], historicSelector, {
        data: ethers.solidityPacked(
          ['bytes4', 'uint256'],
          [historicSelector, 5],
        ),
      });
      const value = data.slice(0, 48).padEnd(66, '0');
      const timestampValue = ethers.toNumber(
        '0x' + data.slice(48, data.length),
      );

      expect(value).to.equal(ethers.encodeBytes32String('value 5'));
      expect(timestampValue).to.equal(timestamp);
    });
  }

  for (let i = 1; i <= 100; i *= 10) {
    it(`Should set ${i} feeds in a single transaction`, async function () {
      await setDataFeeds(
        Object.values(genericContracts),
        Object.values(contracts),
        selector,
        i,
      );
      const { receipts, receiptsGeneric, keys, values } = await setDataFeeds(
        Object.values(genericContracts),
        Object.values(contracts),
        selector,
        i,
      );

      for (const [idx, dataFeed] of Object.values(contracts).entries()) {
        for (const [index, key] of keys.entries()) {
          const storedValue = await getter(
            dataFeed,
            getHistoricSelector(HISTORIC_SELECTORS.GET_LATEST_VALUE, key),
          );

          const data = storedValue.slice(0, 48).padEnd(66, '0');
          const timestamp = ethers.toNumber(
            '0x' + storedValue.slice(48, storedValue.length),
          );

          expect(data).to.equal(values[index]);
          expect(timestamp).to.equal(
            (await ethers.provider.getBlock(receipts[idx].blockNumber))
              ?.timestamp,
          );

          const historicSelector = getHistoricSelector(
            HISTORIC_SELECTORS.GET_LATEST_COUNTER,
            key,
          );
          const counter = await getter(dataFeed, historicSelector);
          expect(+counter).to.equal(2);
        }
      }

      printGasUsage(logger, receipts, receiptsGeneric);

      for (const receipt of receipts) {
        for (const genericReceipt of receiptsGeneric) {
          expect(receipt.gasUsed).to.be.lte(genericReceipt?.gasUsed);
        }
      }
    });
  }
});
