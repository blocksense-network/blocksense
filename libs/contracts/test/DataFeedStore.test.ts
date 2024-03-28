import { expect } from 'chai';
import { ethers, network } from 'hardhat';
import {
  DataFeedStoreGeneric,
  DataFeedStoreGenericV2,
  IDataFeedStore__factory,
  DataFeedStoreV1,
  DataFeedStoreV2,
  DataFeedStoreV3,
} from '../typechain';
import { contractVersionLogger } from './uitls/logger';
import {
  DataFeedStore,
  setter,
  getter,
  getV1Selector,
  getV2Selector,
} from './uitls/helpers';
import { compareGasUsed } from './uitls/helpers/dataFeedGasHelpers';

const contracts: {
  [key: string]: DataFeedStore;
} = {};
const selector =
  IDataFeedStore__factory.createInterface().getFunction('setFeeds').selector;

describe('DataFeedStore', function () {
  let logger: ReturnType<typeof contractVersionLogger>;
  let dataFeedStoreGenericV1: DataFeedStoreGeneric;
  let dataFeedStoreGenericV2: DataFeedStoreGenericV2;

  beforeEach(async function () {
    const DataFeedStoreGeneric = await ethers.getContractFactory(
      'DataFeedStoreGeneric',
    );
    dataFeedStoreGenericV1 = await DataFeedStoreGeneric.deploy();
    await dataFeedStoreGenericV1.waitForDeployment();

    const DataFeedStoreGenericV2 = await ethers.getContractFactory(
      'DataFeedStoreGenericV2',
    );
    dataFeedStoreGenericV2 = await DataFeedStoreGenericV2.deploy();
    await dataFeedStoreGenericV2.waitForDeployment();

    const DataFeedStore = await ethers.getContractFactory('DataFeedStoreV1');
    contracts.V1 = await DataFeedStore.deploy();
    await contracts.V1.waitForDeployment();

    const tx = await contracts.V1.deploymentTransaction()?.getTransaction();

    console.log(
      'DataFeedStoreV1 deployment gas used: ',
      +(await network.provider.send('eth_getTransactionReceipt', [tx?.hash]))
        .gasUsed,
    );

    const DataFeedStoreV2 = await ethers.getContractFactory(`DataFeedStoreV2`);
    contracts.V2 = await DataFeedStoreV2.deploy();
    await contracts.V2.waitForDeployment();

    const tx2 = await contracts.V2.deploymentTransaction()?.getTransaction();

    console.log(
      `DataFeedStoreV2 deployment gas used: `,
      +(await network.provider.send('eth_getTransactionReceipt', [tx2?.hash]))
        .gasUsed,
    );

    const DataFeedStoreV3 = await ethers.getContractFactory(`DataFeedStoreV3`);
    contracts.V3 = await DataFeedStoreV3.deploy();
    await contracts.V3.waitForDeployment();

    const tx3 = await contracts.V3.deploymentTransaction()?.getTransaction();

    console.log(
      `DataFeedStoreV3 deployment gas used: `,
      +(await network.provider.send('eth_getTransactionReceipt', [tx3?.hash]))
        .gasUsed,
    );

    logger = contractVersionLogger(contracts);
  });

  describe('DataFeedStoreV1', function () {
    it('Should be able to set v1 data feed', async function () {
      const key = 3;
      const value = ethers.solidityPacked(
        ['bytes32'],
        [ethers.zeroPadBytes(ethers.toUtf8Bytes('Hello, World!'), 32)],
      );
      await setter(contracts.V1, selector, [key], [value]);

      const res = await getter(contracts.V1, getV1Selector(key));
      expect(res).to.be.eq(value);
    });

    it('Should be able to set 10 v1 data feeds', async function () {
      const keys = Array.from({ length: 10 }, (_, i) => i);
      const values = keys.map(key =>
        ethers.solidityPacked(
          ['bytes32'],
          [ethers.zeroPadBytes(ethers.toUtf8Bytes(`Hello, World ${key}!`), 32)],
        ),
      );
      await setter(contracts.V1, selector, keys, values);

      for (let i = 0; i < keys.length; i++) {
        const res = await getter(contracts.V1, getV1Selector(keys[i]));
        expect(res).to.be.eq(values[i]);
      }
    });
  });

  for (let i = 2; i <= 3; i++) {
    describe(`DataFeedStoreV${i}`, function () {
      let contract: DataFeedStoreV2 | DataFeedStoreV3;

      beforeEach(async function () {
        const keys = Object.keys(contracts);
        contract = contracts[keys[i - 1]];
      });

      it(`Should be able to set v${i} data feed`, async function () {
        const key = 3;
        const value = ethers.solidityPacked(
          ['bytes32'],
          [ethers.zeroPadBytes(ethers.toUtf8Bytes('Hello, World!'), 32)],
        );
        await setter(contract, selector, [key], [value]);

        const res = await getter(contract, getV2Selector(key));
        expect(res).to.be.eq(value);
      });

      it(`Should be able to set 10 v${i} data feeds`, async function () {
        const keys = Array.from({ length: 10 }, (_, i) => i);
        const values = keys.map(key =>
          ethers.solidityPacked(
            ['bytes32'],
            [
              ethers.zeroPadBytes(
                ethers.toUtf8Bytes(`Hello, World ${key}!`),
                32,
              ),
            ],
          ),
        );
        await setter(contract, selector, keys, values);

        for (let i = 0; i < keys.length; i++) {
          const res = await getter(contract, getV2Selector(keys[i]));

          expect(res).to.be.eq(values[i]);
        }
      });

      it(`Should compare v${i} with Generic for 100 biggest uint32 id set`, async function () {
        await compareGasUsed(
          logger,
          [dataFeedStoreGenericV1, dataFeedStoreGenericV2],
          [contract],
          selector,
          100,
          2147483548,
        );
      });

      it('Should test with the biggest possible id', async function () {
        await compareGasUsed(
          logger,
          [dataFeedStoreGenericV1, dataFeedStoreGenericV2],
          [contract],
          selector,
          1,
          0x7fffffff,
        );
      });
    });
  }

  for (let i = 1; i <= 1000; i *= 10) {
    it(`Should fetch and set ${i} feeds in a single transaction`, async function () {
      await compareGasUsed(
        logger,
        [dataFeedStoreGenericV1, dataFeedStoreGenericV2],
        Object.values(contracts),
        selector,
        i,
      );
    });
  }
});
