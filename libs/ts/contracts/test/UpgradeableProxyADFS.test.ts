import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import {
  ADFSWrapper,
  UpgradeableProxyADFSGenericWrapper,
  UpgradeableProxyADFSWrapper,
} from './utils/wrappers';
import { expect } from 'chai';
import { Feed, ProxyOp, ReadOp } from './utils/wrappers/types';
import {
  HistoricalDataFeedStore,
  GenericHistoricalDataFeedStore,
  initWrappers,
} from './experiments/utils/helpers/common';
import {
  UpgradeableProxyHistoricalBaseWrapper,
  UpgradeableProxyHistoricalDataFeedStoreV1Wrapper,
  UpgradeableProxyHistoricalDataFeedStoreV2Wrapper,
  UpgradeableProxyHistoricalDataFeedStoreGenericV1Wrapper,
} from './experiments/utils/wrappers';
import { compareGasUsed } from './utils/helpers/compareGasWithExperiments';

const feed: Feed = {
  id: 0n,
  round: 1n,
  data: ethers.hexlify(ethers.randomBytes(18)),
  stride: 0n,
};

describe('UpgradeableProxyADFS', function () {
  let admin: HardhatEthersSigner;
  let sequencer: HardhatEthersSigner;
  let accessControlAdmin: HardhatEthersSigner;
  let proxy: UpgradeableProxyADFSWrapper;

  beforeEach(async function () {
    admin = (await ethers.getSigners())[9];
    sequencer = (await ethers.getSigners())[10];
    accessControlAdmin = (await ethers.getSigners())[5];

    proxy = new UpgradeableProxyADFSWrapper();
    await proxy.init(await admin.getAddress(), accessControlAdmin);

    await proxy.implementation.accessControl.setAdminStates(
      accessControlAdmin,
      [sequencer.address],
      [true],
    );
  });

  it('Should upgrade implementation', async function () {
    const targetBefore = proxy.implementation.contract.target;
    const newImplementation = new ADFSWrapper();
    await newImplementation.init(await sequencer.getAddress());

    const tx = await proxy.upgradeImplementationAndCall(
      newImplementation,
      admin,
      '0x',
    );
    const receipt = await tx.wait();

    console.log('Gas used: ', Number(receipt?.gasUsed));

    const logs = await proxy.contract.queryFilter(
      proxy.contract.filters.Upgraded(),
    );
    expect(logs.length).to.be.equal(2);
    expect(logs[0].args?.implementation).to.be.equal(targetBefore);
    expect(logs[1].args?.implementation).to.be.equal(
      newImplementation.contract.target,
    );
  });

  it('Should preserve storage when implementation is changed', async function () {
    await proxy.proxyCall('setFeeds', sequencer, [feed]);

    const valueV1 = (await proxy.proxyCall('getValues', sequencer, [feed]))[0];

    const newImplementation = new ADFSWrapper();
    await newImplementation.init(await sequencer.getAddress());

    const tx = await proxy.upgradeImplementationAndCall(
      newImplementation,
      admin,
      '0x',
    );
    const receipt = await tx.wait();

    console.log('Gas used: ', Number(receipt?.gasUsed));

    await expect(tx)
      .to.emit(proxy.contract, 'Upgraded')
      .withArgs(newImplementation.contract);

    const valueV2 = (await proxy.proxyCall('getValues', sequencer, [feed]))[0];

    expect(valueV1).to.be.equal(proxy.implementation.formatData(feed));
    expect(valueV1).to.be.equal(valueV2);
  });

  it('Should preserve storage when implementation is changed and call implementation with calldata', async function () {
    await proxy.proxyCall('setFeeds', sequencer, [feed], {
      blockNumber: 1,
    });

    const valueV1 = (await proxy.proxyCall('getValues', sequencer, [feed]))[0];

    // set up new implementation
    const newImplementation = new ADFSWrapper();
    await newImplementation.init(accessControlAdmin);

    // set admin in access control
    // this is needed to set a feed via calldata when upgrading to new implementation
    await newImplementation.accessControl.setAdminStates(
      accessControlAdmin,
      [admin.address],
      [true],
    );
    await newImplementation.accessControl.checkAdmin(
      admin,
      [admin.address],
      [1n],
    );

    const newFeed = {
      ...feed,
      round: feed.round + 1n,
      data: ethers.hexlify(ethers.randomBytes(18)),
    };

    // set feed at round 2 when upgrading to new implementation
    const blocknumber = 1234;
    const callData = newImplementation.encodeDataWrite([newFeed], blocknumber);

    const tx = await proxy.upgradeImplementationAndCall(
      newImplementation,
      admin,
      callData,
    );

    const receipt = await tx.wait();

    console.log('Gas used: ', Number(receipt?.gasUsed));

    await expect(tx)
      .to.emit(proxy.contract, 'Upgraded')
      .withArgs(newImplementation.contract);
    newImplementation.checkEvent(receipt!, blocknumber);

    // get old value at round 1 and assert that is hasn't changed after upgrade
    const valueV2 = (
      await proxy.proxyCall('getValues', sequencer, [feed], {
        operations: [ReadOp.GetFeedAtRound],
      })
    )[0];

    expect(valueV1).to.be.equal(proxy.implementation.formatData(feed));
    expect(valueV1).to.be.equal(valueV2);

    // get new value at round 2 and assert that the provided calldata on upgrade sets it correctly
    const newValue = (
      await proxy.proxyCall('getValues', sequencer, [newFeed])
    )[0];
    expect(newValue).to.be.equal(proxy.implementation.formatData(newFeed));
  });

  it('Should revert when sending msg value for an upgrade without calldata', async function () {
    const newImplementation = new ADFSWrapper();
    await newImplementation.init(await sequencer.getAddress());
    const tx = proxy.upgradeImplementationAndCall(
      newImplementation,
      admin,
      '0x',
      { txData: { value: 1 } },
    );

    await expect(tx).to.be.revertedWithCustomError(
      proxy.contract,
      'ERC1967NonPayable',
    );
  });

  it('Should revert if upgrade is not called by the admin', async function () {
    const newImplementation = new ADFSWrapper();
    await newImplementation.init(await sequencer.getAddress());

    const tx = proxy.upgradeImplementationAndCall(
      newImplementation,
      sequencer,
      '0x',
    );

    await expect(tx).to.be.reverted;
  });

  it('Should allow admin to read feeds', async function () {
    await proxy.proxyCall('setFeeds', sequencer, [feed]);

    const value = (await proxy.proxyCall('getValues', admin, [feed]))[0];
    expect(value).to.be.equal(proxy.implementation.formatData(feed));
  });

  it('Should revert if admin calls set feed', async function () {
    const tx = proxy.proxyCall('setFeeds', admin, [feed]);
    await expect(tx).to.be.reverted;
  });

  it('Should revert if non-owner calls set feed', async function () {
    const tx = proxy.proxyCall('setFeeds', (await ethers.getSigners())[8], [
      feed,
    ]);

    await expect(tx).to.be.reverted;
  });

  it('Should revert if the new implementation is not a contract', async function () {
    const newImplementation = new ADFSWrapper();
    await newImplementation.init(await sequencer.getAddress());

    const tx = proxy.upgradeImplementationAndCall(
      newImplementation,
      admin,
      '0x',
      {
        txData: {
          data: ethers.solidityPacked(
            ['bytes4', 'address'],
            [ProxyOp.UpgradeTo, await admin.getAddress()],
          ),
        },
      },
    );

    await expect(tx).to.be.reverted;
  });

  it('Should change admin', async function () {
    const newAdmin = (await ethers.getSigners())[11];
    const tx = await proxy.setAdmin(admin, newAdmin.address);

    expect(tx)
      .to.emit(proxy.contract, 'AdminChanged')
      .withArgs(admin, newAdmin);
  });

  it('Should revert if non-admin tries to change admin', async function () {
    const newAdmin = (await ethers.getSigners())[11];
    await expect(proxy.setAdmin(sequencer, newAdmin.address)).to.be.reverted;
  });

  describe('Compare gas usage', function () {
    let historicalContractWrappers: UpgradeableProxyHistoricalBaseWrapper<HistoricalDataFeedStore>[] =
      [];
    let historicalContractGenericWrappers: UpgradeableProxyHistoricalBaseWrapper<GenericHistoricalDataFeedStore>[] =
      [];

    let genericProxy: UpgradeableProxyADFSGenericWrapper;

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

      proxy = new UpgradeableProxyADFSWrapper();
      await proxy.init(await admin.getAddress(), accessControlAdmin);

      await proxy.implementation.accessControl.setAdminStates(
        accessControlAdmin,
        [sequencer.address],
        [true],
      );

      genericProxy = new UpgradeableProxyADFSGenericWrapper();
      await genericProxy.init(await admin.getAddress(), accessControlAdmin);

      await genericProxy.implementation.accessControl.setAdminStates(
        accessControlAdmin,
        [sequencer.address],
        [true],
      );

      // store no data first time in ADFS to avoid first sstore of blocknumber
      await proxy.proxyCall('setFeeds', sequencer, []);

      await genericProxy.proxyCall('setFeeds', sequencer, []);
    });

    for (let i = 1; i <= 100; i *= 10) {
      it(`Should set ${i} data feeds`, async function () {
        await compareGasUsed(
          sequencer,
          historicalContractGenericWrappers,
          historicalContractWrappers,
          [proxy],
          [genericProxy],
          i,
          {
            round: 1n,
          },
        );

        await compareGasUsed(
          sequencer,
          historicalContractGenericWrappers,
          historicalContractWrappers,
          [proxy],
          [genericProxy],
          i,
          {
            round: 2n,
          },
        );
      });

      it(`Should set ${i} data feeds every 16 id`, async function () {
        await compareGasUsed(
          sequencer,
          historicalContractGenericWrappers,
          historicalContractWrappers,
          [proxy],
          [genericProxy],
          i,
          {
            skip: 16,
            round: 1n,
          },
        );

        await compareGasUsed(
          sequencer,
          historicalContractGenericWrappers,
          historicalContractWrappers,
          [proxy],
          [genericProxy],
          i,
          {
            skip: 16,
            round: 2n,
          },
        );
      });
    }
  });
});
