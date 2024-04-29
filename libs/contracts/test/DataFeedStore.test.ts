import { expect } from 'chai';
import { ethers as hre } from 'hardhat';
import {
  DataFeedStore,
  GenericDataFeedStore,
  initWrappers,
} from './utils/helpers/common';
import { compareGasUsed } from './utils/helpers/dataFeedGasHelpers';
import {
  DataFeedStoreGenericV1Wrapper,
  DataFeedStoreGenericV2Wrapper,
  DataFeedStoreBaseWrapper,
  DataFeedStoreV1Wrapper,
  DataFeedStoreV2Wrapper,
  DataFeedStoreV3Wrapper,
  IWrapper,
} from './utils/wrappers';
import { ethers } from 'ethers';

let contracts: IWrapper<DataFeedStore>[] = [];
let genericContracts: IWrapper<GenericDataFeedStore>[] = [];

describe('DataFeedStore', function () {
  beforeEach(async function () {
    contracts = [];
    genericContracts = [];

    await initWrappers(contracts, [
      DataFeedStoreV1Wrapper,
      DataFeedStoreV2Wrapper,
      DataFeedStoreV3Wrapper,
    ]);

    await initWrappers(genericContracts, [
      DataFeedStoreGenericV1Wrapper,
      DataFeedStoreGenericV2Wrapper,
    ]);
  });

  for (let i = 0; i < 3; i++) {
    describe(`DataFeedStoreV${i + 1}`, function () {
      it('Should revert if the selector is not correct', async function () {
        const value = ethers.zeroPadBytes('0xa0000000', 32);
        await expect(
          (contracts[i] as DataFeedStoreBaseWrapper).customSetFeeds(
            '0x10000000',
            [1],
            [value],
          ),
        ).to.be.reverted;
      });

      it('Should revert if the caller is not the owner', async function () {
        const value = ethers.zeroPadBytes('0xa0000000', 32);

        await expect(
          contracts[i].setFeeds([1], [value], {
            from: await (await hre.getSigners())[3].getAddress(),
          }),
        ).to.be.reverted;
      });
    });
  }

  it(`Should compare v2 & v3 with Generic with 100 biggest uint32 id set`, async function () {
    await compareGasUsed<GenericDataFeedStore, DataFeedStore>(
      genericContracts,
      [contracts[1], contracts[2]],
      100,
      2147483548,
    );
  });

  it('Should compare v2 & v3 with Generic with the biggest possible id', async function () {
    await compareGasUsed<GenericDataFeedStore, DataFeedStore>(
      genericContracts,
      [contracts[1], contracts[2]],
      1,
      0x7fffffff,
    );
  });

  for (let i = 1; i <= 1000; i *= 10) {
    it(`Should get and set ${i} feeds in a single transaction`, async function () {
      await compareGasUsed<GenericDataFeedStore, DataFeedStore>(
        genericContracts,
        contracts,
        i,
      );
    });
  }
});
