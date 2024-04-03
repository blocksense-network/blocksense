import { Signer } from 'ethers';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import {
  DataFeedStoreV1,
  DataFeedStoreV2,
  DataFeedStoreV3,
  UpgradableProxy,
  ITransparentUpgradeableProxy__factory,
  IDataFeedStore__factory,
  DataFeedStoreGenericV1,
  DataFeedStoreGenericV2,
} from '../typechain';
import { DataFeedStoreGenericV1Interface } from '../typechain/contracts/test/DataFeedStoreGenericV1';
import { DataFeedStoreGenericV2Interface } from '../typechain/contracts/test/DataFeedStoreGenericV2';
import {
  DataFeedStore,
  GenericDataFeedStore,
  checkSetValues,
  deployContract,
  getV1Selector,
  getV2Selector,
  getter,
  printGasUsage,
  setter,
} from './uitls/helpers';
import { contractVersionLogger } from './uitls/logger';

const contractsImpl: {
  [key: string]: DataFeedStore;
} = {};
const contractsGenericImpl: {
  [key: string]: GenericDataFeedStore;
} = {};
const selector =
  IDataFeedStore__factory.createInterface().getFunction('setFeeds').selector;
const upgradeSelector =
  ITransparentUpgradeableProxy__factory.createInterface().getFunction(
    'upgradeToAndCall',
  ).selector;

describe('UpgradableProxy', function () {
  let admin: Signer;
  let upgradableContractsImpl: UpgradableProxy;

  beforeEach(async function () {
    admin = (await ethers.getSigners())[9];

    contractsGenericImpl.V1 = await deployContract<DataFeedStoreGenericV1>(
      'DataFeedStoreGenericV1',
    );
    contractsGenericImpl.V2 = await deployContract<DataFeedStoreGenericV2>(
      'DataFeedStoreGenericV2',
    );

    contractsImpl.V1 = await deployContract<DataFeedStoreV1>('DataFeedStoreV1');
    contractsImpl.V2 = await deployContract<DataFeedStoreV2>('DataFeedStoreV2');
    contractsImpl.V3 = await deployContract<DataFeedStoreV3>('DataFeedStoreV3');

    upgradableContractsImpl = await deployContract<UpgradableProxy>(
      'UpgradableProxy',
      contractsImpl.V1.target,
      await admin.getAddress(),
    );
  });

  it('Should upgrade from V1 to V2', async function () {
    const receipt = await setter(
      upgradableContractsImpl,
      upgradeSelector,
      [],
      [],
      {
        from: await admin.getAddress(),
        data: ethers.solidityPacked(
          ['bytes4', 'address'],
          [upgradeSelector, contractsImpl.V2.target],
        ),
      },
    );

    console.log('Gas used: ', Number(receipt.gasUsed));

    const logs = await upgradableContractsImpl.queryFilter(
      upgradableContractsImpl.filters.Upgraded(),
    );
    expect(logs.length).to.be.equal(2);
    expect(logs[0].args?.implementation).to.be.equal(contractsImpl.V1.target);
    expect(logs[1].args?.implementation).to.be.equal(contractsImpl.V2.target);
  });

  it('Should preserve storage when implementation is changed', async function () {
    const value = ethers.encodeBytes32String('key');
    await setter(upgradableContractsImpl, selector, [0], [value]);

    const valueV1 = await getter(upgradableContractsImpl, getV1Selector(0));

    const tx = await setter(upgradableContractsImpl, upgradeSelector, [], [], {
      from: await admin.getAddress(),
      data: ethers.solidityPacked(
        ['bytes4', 'address'],
        [upgradeSelector, contractsImpl.V2.target],
      ),
    });

    console.log('Gas used: ', Number(tx.gasUsed));

    await expect(tx.transactionHash)
      .to.emit(upgradableContractsImpl, 'Upgraded')
      .withArgs(contractsImpl.V2.target);

    const valueV2 = await getter(upgradableContractsImpl, getV2Selector(0));

    expect(valueV1).to.be.equal(value);
    expect(valueV1).to.be.equal(valueV2);
  });

  it('Should revert if upgrade is not called by the admin', async function () {
    const tx = setter(upgradableContractsImpl, upgradeSelector, [], [], {
      from: (await ethers.getSigners())[8].address,
      data: ethers.solidityPacked(
        ['bytes4', 'address'],
        [upgradeSelector, contractsImpl.V2.target],
      ),
    });

    await expect(tx).to.be.reverted;
  });

  it('Should revert if admin calls something other than upgrade', async function () {
    let tx = setter(
      upgradableContractsImpl,
      selector,
      [0],
      [ethers.encodeBytes32String('key')],
      {
        from: await admin.getAddress(),
      },
    );

    await expect(tx).to.be.revertedWithCustomError(
      upgradableContractsImpl,
      'ProxyDeniedAdminAccess',
    );

    tx = getter(upgradableContractsImpl, getV1Selector(0), {
      from: await admin.getAddress(),
    });

    await expect(tx).to.be.revertedWithCustomError(
      upgradableContractsImpl,
      'ProxyDeniedAdminAccess',
    );
  });

  it('Should revert if non-owner calls set feed', async function () {
    const tx = setter(
      upgradableContractsImpl,
      selector,
      [0],
      [ethers.encodeBytes32String('key')],
      {
        from: (await ethers.getSigners())[8].address,
      },
    );

    await expect(tx).to.be.reverted;
  });

  describe('Compare gas usage', function () {
    const upgradableContracts: {
      [key: string]: UpgradableProxy;
    } = {};
    const upgradableGenericContracts: {
      [key: string]: UpgradableProxy;
    } = {};
    let logger: ReturnType<typeof contractVersionLogger>;

    beforeEach(async function () {
      upgradableGenericContracts.V1 = await deployContract<UpgradableProxy>(
        'UpgradableProxy',
        contractsGenericImpl.V1.target,
        await admin.getAddress(),
      );
      upgradableGenericContracts.V2 = await deployContract<UpgradableProxy>(
        'UpgradableProxy',
        contractsGenericImpl.V2.target,
        await admin.getAddress(),
      );

      upgradableContracts.V1 = await deployContract<UpgradableProxy>(
        'UpgradableProxy',
        contractsImpl.V1.target,
        await admin.getAddress(),
      );
      upgradableContracts.V2 = await deployContract<UpgradableProxy>(
        'UpgradableProxy',
        contractsImpl.V2.target,
        await admin.getAddress(),
      );
      upgradableContracts.V3 = await deployContract<UpgradableProxy>(
        'UpgradableProxy',
        contractsImpl.V3.target,
        await admin.getAddress(),
      );

      logger = contractVersionLogger([
        upgradableContracts,
        upgradableGenericContracts,
      ]);
    });

    for (let i = 1; i <= 1000; i *= 10) {
      it(`Should set ${i} data feeds`, async function () {
        const keys = Array.from({ length: i }, (_, j) => j);
        const values = keys.map(key =>
          ethers.encodeBytes32String(`Hello, World! ${key}`),
        );

        const receipts = [];
        for (const contract of Object.values(upgradableContracts)) {
          receipts.push(await setter(contract, selector, keys, values));
        }

        checkSetValues(
          Object.values(upgradableContracts),
          logger,
          keys,
          values,
        );

        const ifaceV1 = contractsGenericImpl.V1
          .interface as DataFeedStoreGenericV1Interface;
        const txG1 = await setter(
          upgradableGenericContracts.V1,
          ifaceV1.getFunction('setFeeds')!.selector,
          [],
          [],
          {
            data: ifaceV1.encodeFunctionData('setFeeds', [keys, values]),
          },
        );

        const ifaceV2 = contractsGenericImpl.V2
          .interface as DataFeedStoreGenericV2Interface;
        const txG2 = await setter(
          upgradableGenericContracts.V2,
          selector,
          [],
          [],
          {
            data: ifaceV2.encodeFunctionData('setFeeds', [
              ethers.solidityPacked(
                [...keys.map(() => ['uint32', 'bytes32']).flat()],
                [...keys.flatMap((key, i) => [key, values[i]])],
              ),
            ]),
          },
        );

        for (const [index, contract] of Object.values(
          upgradableGenericContracts,
        ).entries()) {
          const iface = Object.values(contractsGenericImpl)[index].interface;
          for (let i = 0; i < keys.length; i++) {
            const value = await getter(
              contract,
              iface.getFunction('getDataFeed')!.selector,
              {
                data: iface.encodeFunctionData('getDataFeed', [keys[i]]),
              },
            );

            expect(value).to.be.equal(values[i]);
          }
        }

        let receiptsGeneric = [txG1, txG2];

        printGasUsage(logger, receipts, receiptsGeneric);
      });
    }
  });
});
