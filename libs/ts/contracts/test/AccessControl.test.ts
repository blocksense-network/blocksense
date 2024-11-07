import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { AccessControl } from '../typechain/contracts/AccessControl';
import { ethers } from 'hardhat';
import { deployContract } from './utils/helpers/common';
import { expect } from 'chai';

enum Selector {
  CheckAdminRole = '0xe386be2e',
  SetAdmins = '0xaccc1d5e',
}

describe('AccessControl', () => {
  let accessControl: AccessControl;
  let signers: HardhatEthersSigner[];
  let admins: string[];

  beforeEach(async () => {
    signers = await ethers.getSigners();
    accessControl = await deployContract<AccessControl>(
      'AccessControl',
      signers[0].address,
    );

    admins = signers.slice(1).map(signer => signer.address);

    const encodedData = ethers.solidityPacked(
      [...admins.map(() => 'address')],
      [...admins],
    );

    await signers[0].sendTransaction({
      to: accessControl.target,
      data: Selector.SetAdmins.concat(encodedData.slice(2)),
    });
  });

  it('Should return true for admin', async () => {
    for (const admin of admins) {
      const res = await signers[0].call({
        to: accessControl.target,
        data: Selector.CheckAdminRole.concat(admin.slice(2)),
      });

      expect(res).to.be.equal(1n);
    }
  });

  it('Should return false when not admin', async () => {
    const res = await signers[0].call({
      to: accessControl.target,
      data: Selector.CheckAdminRole.concat(signers[0].address.slice(2)),
    });

    expect(res).to.be.equal(0n);
  });

  it('Should revert on setting admins when not owner', async () => {
    await expect(
      signers[1].sendTransaction({
        to: accessControl.target,
        data: Selector.SetAdmins.concat(
          ethers.solidityPacked(['address'], [signers[0].address]).slice(2),
        ),
      }),
    ).to.be.reverted;
  });
});
