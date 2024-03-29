import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
  DataFeedStoreGenericV1,
  DataFeedStoreGenericV2,
  IDataFeedStore__factory,
  DataFeedStoreV1,
  DataFeedStoreV2,
  DataFeedStoreV3,
} from '../typechain';
import { contractVersionLogger } from './uitls/logger';
import { DataFeedStore, setter, GenericDataFeedStore } from './uitls/helpers';
import { compareGasUsed } from './uitls/helpers/dataFeedGasHelpers';
import { deployContract } from './uitls/helpers';

const contracts: {
  [key: string]: DataFeedStore;
} = {};
const genericContracts: {
  [key: string]: GenericDataFeedStore;
} = {};
const selector =
  IDataFeedStore__factory.createInterface().getFunction('setFeeds').selector;

describe('DataFeedStore', function () {
  let logger: ReturnType<typeof contractVersionLogger>;

  beforeEach(async function () {
    genericContracts.V1 = await deployContract<DataFeedStoreGenericV1>(
      'DataFeedStoreGenericV1',
    );
    genericContracts.V2 = await deployContract<DataFeedStoreGenericV2>(
      'DataFeedStoreGenericV2',
    );

    contracts.V1 = await deployContract<DataFeedStoreV1>('DataFeedStoreV1');
    contracts.V2 = await deployContract<DataFeedStoreV2>('DataFeedStoreV2');
    contracts.V3 = await deployContract<DataFeedStoreV3>('DataFeedStoreV3');

    logger = contractVersionLogger([contracts, genericContracts]);
  });

  for (let i = 1; i <= 3; i++) {
    describe(`DataFeedStoreV${i}`, function () {
      it('Should revert if the selector is not correct', async function () {
        const value = ethers.zeroPadBytes('0xa0000000', 32);
        await expect(setter(contracts[`V${i}`], '0x10000000', [1], [value])).to
          .be.reverted;
      });

      it('Should revert if the caller is not the owner', async function () {
        const value = ethers.zeroPadBytes('0xa0000000', 32);
        await expect(
          setter(contracts[`V${i}`], selector, [1], [value], {
            from: await (await ethers.getSigners())[3].getAddress(),
          }),
        ).to.be.reverted;
      });
    });
  }

  it(`Should compare v2 & v3 with Generic with 100 biggest uint32 id set`, async function () {
    await compareGasUsed(
      logger,
      Object.values(genericContracts),
      [contracts.V2, contracts.V3],
      selector,
      100,
      2147483548,
    );
  });

  it('Should compare v2 & v3 with Generic with the biggest possible id', async function () {
    await compareGasUsed(
      logger,
      Object.values(genericContracts),
      [contracts.V2, contracts.V3],
      selector,
      1,
      0x7fffffff,
    );
  });

  for (let i = 1; i <= 1000; i *= 10) {
    it(`Should get and set ${i} feeds in a single transaction`, async function () {
      await compareGasUsed(
        logger,
        Object.values(genericContracts),
        Object.values(contracts),
        selector,
        i,
      );
    });
  }
});
