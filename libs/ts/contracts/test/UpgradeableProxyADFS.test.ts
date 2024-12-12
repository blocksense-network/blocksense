import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import { ADFSWrapper, UpgradeableProxyADFSWrapper } from './utils/wrappers';
import { expect } from 'chai';
import { Feed } from './utils/wrappers/types';
import { IUpgradeableProxy__factory } from '../typechain';

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

    await proxy.implementation.accessControl.set(
      accessControlAdmin,
      [sequencer.address],
      [true],
    );
  });

  it('Should upgrade implementation', async function () {
    const targetBefore = proxy.implementation.contract.target;
    const newImplementation = new ADFSWrapper();
    await newImplementation.init(await sequencer.getAddress());

    const tx = await proxy.upgradeImplementation(newImplementation, admin);
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

    const tx = await proxy.upgradeImplementation(newImplementation, admin);
    const receipt = await tx.wait();

    console.log('Gas used: ', Number(receipt?.gasUsed));

    await expect(tx)
      .to.emit(proxy.contract, 'Upgraded')
      .withArgs(newImplementation.contract);

    const valueV2 = (await proxy.proxyCall('getValues', sequencer, [feed]))[0];

    expect(valueV1).to.be.equal(proxy.implementation.formatData(feed.data));
    expect(valueV1).to.be.equal(valueV2);
  });

  it('Should revert if upgrade is not called by the admin', async function () {
    const newImplementation = new ADFSWrapper();
    await newImplementation.init(await sequencer.getAddress());

    const tx = proxy.upgradeImplementation(newImplementation, sequencer);

    await expect(tx).to.be.reverted;
  });

  it('Should revert if admin calls something other than upgrade', async function () {
    let tx = proxy.proxyCall('setFeeds', admin, [feed]);

    await expect(tx).to.be.revertedWithCustomError(
      proxy.contract,
      'ProxyDeniedAdminAccess',
    );

    tx = proxy.proxyCall('getValues', admin, [feed]);

    await expect(tx).to.be.revertedWithCustomError(
      proxy.contract,
      'ProxyDeniedAdminAccess',
    );
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

    const tx = proxy.upgradeImplementation(newImplementation, admin, {
      txData: {
        data: ethers.solidityPacked(
          ['bytes4', 'address'],
          [
            IUpgradeableProxy__factory.createInterface().getFunction(
              'upgradeTo',
            ).selector,
            await admin.getAddress(),
          ],
        ),
      },
    });

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
});
