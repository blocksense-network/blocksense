import { Signer } from 'ethers';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import {
  DataFeedStore,
  GenericDataFeedStore,
  GenericHistoricalDataFeedStore,
  HistoricalDataFeedStore,
  initWrappers,
} from './utils/helpers/common';
import {
  UpgradeableProxyBaseWrapper,
  UpgradeableProxyDataFeedStoreV1GenericWrapper,
  UpgradeableProxyDataFeedStoreV1Wrapper,
  UpgradeableProxyDataFeedStoreV2GenericWrapper,
  UpgradeableProxyDataFeedStoreV2Wrapper,
  UpgradeableProxyDataFeedStoreV3Wrapper,
  UpgradeableProxyHistoricalBaseWrapper,
  UpgradeableProxyHistoricalDataFeedStoreGenericV1Wrapper,
  UpgradeableProxyHistoricalDataFeedStoreV1Wrapper,
  UpgradeableProxyHistoricalDataFeedStoreV2Wrapper,
} from './utils/wrappers';
import { compareGasUsed } from './utils/helpers/dataFeedGasHelpers';
import { ITransparentUpgradeableProxy__factory } from '@blocksense/contracts/typechain';

let contractWrappers: UpgradeableProxyBaseWrapper<DataFeedStore>[] = [];
let contractGenericWrappers: UpgradeableProxyBaseWrapper<GenericDataFeedStore>[] =
  [];

describe('UpgradeableProxy', function () {
  let admin: Signer;

  beforeEach(async function () {
    admin = (await ethers.getSigners())[9];
    contractWrappers = [];
    contractGenericWrappers = [];

    await initWrappers(
      contractWrappers,
      [
        UpgradeableProxyDataFeedStoreV1Wrapper,
        UpgradeableProxyDataFeedStoreV2Wrapper,
        UpgradeableProxyDataFeedStoreV3Wrapper,
      ],
      ...Array(3).fill([await admin.getAddress()]),
    );

    await initWrappers(
      contractGenericWrappers,
      [
        UpgradeableProxyDataFeedStoreV1GenericWrapper,
        UpgradeableProxyDataFeedStoreV2GenericWrapper,
      ],
      ...Array(2).fill([await admin.getAddress()]),
    );
  });

  it('Should upgrade from V1 to V2', async function () {
    const targetBefore = contractWrappers[0].implementation.contract.target;

    const receipt = await contractWrappers[0].upgradeImplementation(
      contractWrappers[1].implementation,
      {
        from: await admin.getAddress(),
      },
    );

    console.log('Gas used: ', Number(receipt.gasUsed));

    const logs = await contractWrappers[0].contract.queryFilter(
      contractWrappers[0].contract.filters.Upgraded(),
    );
    expect(logs.length).to.be.equal(2);
    expect(logs[0].args?.implementation).to.be.equal(targetBefore);
    expect(logs[1].args?.implementation).to.be.equal(
      contractWrappers[1].implementation.contract.target,
    );
  });

  it('Should preserve storage when implementation is changed', async function () {
    const value = ethers.encodeBytes32String('key');
    await contractWrappers[0].setFeeds([0], [value]);

    const valueV1 = await contractWrappers[0].getValue(
      contractWrappers[0].implementation.getLatestValueData(0),
    );

    const tx = await contractWrappers[0].upgradeImplementation(
      contractWrappers[1].implementation,
      {
        from: await admin.getAddress(),
      },
    );

    console.log('Gas used: ', Number(tx.gasUsed));

    await expect(tx.transactionHash)
      .to.emit(contractWrappers[0].contract, 'Upgraded')
      .withArgs(contractWrappers[1].implementation.contract);

    const valueV2 = await contractWrappers[0].getValue(
      contractWrappers[1].implementation.getLatestValueData(0),
    );

    expect(valueV1).to.be.equal(value);
    expect(valueV1).to.be.equal(valueV2);
  });

  it('Should revert if upgrade is not called by the admin', async function () {
    const tx = contractWrappers[0].upgradeImplementation(
      contractWrappers[1].implementation,
    );

    await expect(tx).to.be.reverted;
  });

  it('Should revert if admin calls something other than upgrade', async function () {
    let tx = contractWrappers[0].setFeeds(
      [0],
      [ethers.encodeBytes32String('key')],
      {
        from: await admin.getAddress(),
      },
    );

    await expect(tx).to.be.revertedWithCustomError(
      contractWrappers[0].contract,
      'ProxyDeniedAdminAccess',
    );

    tx = contractWrappers[0].getValue(
      contractWrappers[0].implementation.getLatestValueData(0),
      {
        from: await admin.getAddress(),
      },
    );

    await expect(tx).to.be.revertedWithCustomError(
      contractWrappers[0].contract,
      'ProxyDeniedAdminAccess',
    );
  });

  it('Should revert if non-owner calls set feed', async function () {
    const tx = contractWrappers[0].setFeeds(
      [0],
      [ethers.encodeBytes32String('key')],
      {
        from: (await ethers.getSigners())[8].address,
      },
    );

    await expect(tx).to.be.reverted;
  });

  it('Should revert if the new implementation is not a contract', async function () {
    const tx = contractWrappers[0].upgradeImplementation(
      contractWrappers[1].implementation,
      {
        from: await admin.getAddress(),
        data: ethers.solidityPacked(
          ['bytes4', 'address'],
          [
            ITransparentUpgradeableProxy__factory.createInterface().getFunction(
              'upgradeToAndCall',
            ).selector,
            await admin.getAddress(),
          ],
        ),
      },
    );

    await expect(tx).to.be.reverted;
  });

  describe('Compare gas usage', function () {
    for (let i = 1; i <= 1; i *= 10) {
      it(`Should set ${i} data feeds`, async function () {
        await compareGasUsed(contractGenericWrappers, contractWrappers, i);
      });
    }
  });

  describe('Compare gas usage for historical contracts', function () {
    let historicalContractWrappers: UpgradeableProxyHistoricalBaseWrapper<HistoricalDataFeedStore>[] =
      [];
    let historicalContractGenericWrappers: UpgradeableProxyHistoricalBaseWrapper<GenericHistoricalDataFeedStore>[] =
      [];

    beforeEach(async function () {
      historicalContractWrappers = [];
      historicalContractGenericWrappers = [];

      await initWrappers(
        historicalContractWrappers,
        [
          UpgradeableProxyHistoricalDataFeedStoreV1Wrapper,
          UpgradeableProxyHistoricalDataFeedStoreV2Wrapper,
        ],
        ...Array(2).fill([await admin.getAddress()]),
      );

      await initWrappers(
        historicalContractGenericWrappers,
        [UpgradeableProxyHistoricalDataFeedStoreGenericV1Wrapper],
        ...Array(1).fill([await admin.getAddress()]),
      );
    });

    for (let i = 0; i < 2; i++) {
      describe(`Proxy HistoricalDataFeedStoreV${i + 1}`, function () {
        this.timeout(1000000);

        it('Should set and get correct values', async function () {
          const key = 1;
          const value = ethers.encodeBytes32String('value');

          const receipt = await historicalContractWrappers[i].setFeeds(
            [key],
            [value],
          );

          await historicalContractWrappers[i].checkSetValues([key], [value]);
          await historicalContractWrappers[i].checkSetTimestamps(
            [key],
            [receipt.blockNumber],
          );
        });

        it('Should get the current counter', async function () {
          const key = 1;
          const value = ethers.encodeBytes32String('value');

          await historicalContractWrappers[i].setFeeds([key], [value]);
          await historicalContractWrappers[i].checkLatestCounter(key, 1);
        });

        it('Should get the current counter after 10 iterations', async function () {
          const key = 1;
          const value = ethers.encodeBytes32String('value');

          for (let j = 0; j < 10; j++) {
            await historicalContractWrappers[i].setFeeds([key], [value]);
          }

          await historicalContractWrappers[i].checkLatestCounter(key, 10);
        });

        it('Should get value at counter 5', async function () {
          const key = 1;
          const counter = 5;
          let blockNumber = 0;

          for (let j = 1; j <= 10; j++) {
            const value = ethers.encodeBytes32String('value ' + j);
            const receipt = await historicalContractWrappers[i].setFeeds(
              [key],
              [value],
            );
            if (j === counter) {
              blockNumber = receipt.blockNumber;
            }
          }
          await historicalContractWrappers[i].checkValueAtCounter(
            key,
            counter,
            ethers.encodeBytes32String('value ' + counter),
            blockNumber,
          );
        });
      });
    }

    for (let i = 1; i <= 100; i *= 10) {
      it(`Should set ${i} feeds in a single transaction`, async function () {
        await compareGasUsed(
          historicalContractGenericWrappers,
          historicalContractWrappers,
          i,
        );
        const { keys, values, receipts, receiptsGeneric } =
          await compareGasUsed(
            historicalContractGenericWrappers,
            historicalContractWrappers,
            i,
          );

        for (const [i, key] of keys.entries()) {
          for (const [j, wrapper] of historicalContractWrappers.entries()) {
            await wrapper.checkLatestCounter(key, 2);
            await wrapper.checkSetTimestamps([key], [receipts[j].blockNumber]);
            await wrapper.checkValueAtCounter(
              key,
              2,
              values[i],
              receipts[j].blockNumber,
            );
          }

          for (const [
            j,
            wrapper,
          ] of historicalContractGenericWrappers.entries()) {
            await wrapper.checkLatestCounter(key, 2);
            await wrapper.checkSetTimestamps(
              [key],
              [receiptsGeneric[j].blockNumber],
            );
            await wrapper.checkValueAtCounter(
              key,
              2,
              values[i],
              receiptsGeneric[j].blockNumber,
            );
          }
        }
      });
    }
  });
});
