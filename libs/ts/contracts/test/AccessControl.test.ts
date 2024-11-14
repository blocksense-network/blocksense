import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { AccessControl } from '../typechain/contracts/AccessControl';
import { ethers } from 'hardhat';
import { deployContract } from './utils/helpers/common';
import { expect } from 'chai';

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

    admins = signers.slice(1, 2).map(signer => signer.address);

    const encodedData = ethers.solidityPacked(
      [...admins.map(() => 'address')],
      [...admins],
    );

    await signers[0].sendTransaction({
      to: accessControl.target,
      data: encodedData,
    });
  });

  it('Should return true for admin', async () => {
    for (const admin of admins) {
      const res = await signers[5].call({
        to: accessControl.target,
        data: admin,
      });

      expect(res).to.be.equal(1n);
    }
  });

  it('Should return false when not admin', async () => {
    const res = await signers[5].call({
      to: accessControl.target,
      data: signers[0].address,
    });

    expect(res).to.be.equal(0n);
  });

  it('Should not set admin if not owner', async () => {
    const newAdmin = ethers.Wallet.createRandom().address;

    await signers[5].sendTransaction({
      to: accessControl.target,
      data: newAdmin,
    });

    const res = await signers[5].call({
      to: accessControl.target,
      data: newAdmin,
    });

    expect(res).to.be.equal(0n);
  });
});
