import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import { AccessControlWrapper } from './utils/wrappers/adfs/AccessControl';

describe('AccessControl', () => {
  let accessControl: AccessControlWrapper;
  let signers: HardhatEthersSigner[];
  let admins: HardhatEthersSigner[];
  let owner: HardhatEthersSigner;

  beforeEach(async () => {
    signers = await ethers.getSigners();
    accessControl = new AccessControlWrapper();
    owner = signers[0];
    await accessControl.init(owner);

    admins = signers.slice(1, 6);

    await accessControl.setAdminStates(
      owner,
      admins.map(signer => signer.address),
      admins.map(() => true),
    );
  });

  it('Should return true for admin', async () => {
    await accessControl.checkAdmin(
      signers[10],
      admins.map(signer => signer.address),
      admins.map(() => 1n),
    );
  });

  it('Should return false when not admin', async () => {
    await accessControl.checkAdmin(signers[1], [signers[10].address], [0n]);
  });

  it('Should not set admin if not owner', async () => {
    const newAdmin = signers[10];

    await accessControl.setAdminStates(signers[5], [newAdmin.address], [true]);
    await accessControl.checkAdmin(signers[10], [newAdmin.address], [0n]);
  });

  it('Should unset admin', async () => {
    await accessControl.checkAdmin(signers[10], [admins[0].address], [1n]);
    await accessControl.setAdminStates(owner, [admins[0].address], [false]);
    await accessControl.checkAdmin(signers[10], [admins[0].address], [0n]);
  });
});
