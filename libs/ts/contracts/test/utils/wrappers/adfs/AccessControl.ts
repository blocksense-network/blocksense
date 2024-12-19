import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { AccessControl } from '../../../../typechain';
import { deployContract } from '../../../experiments/utils/helpers/common';
import { ethers } from 'hardhat';
import { expect } from 'chai';

export class AccessControlWrapper {
  public contract!: AccessControl;

  public async init(data: HardhatEthersSigner | string) {
    if (typeof data === 'string') {
      this.contract = await ethers.getContractAt('AccessControl', data);
    } else {
      this.contract = await deployContract<AccessControl>(
        'AccessControl',
        data.address,
      );
    }
  }

  public getName(): string {
    return 'AccessControl';
  }

  /**
   * @param owner - Owner of the contract.
   * @param adminAddresses - Addresses of the admins.
   * @param states - States of the admins.
   * @dev Sets the states of the admins.
   * The owner can set the states of the admins.
   * If the `owner` is not the owner of the contract, the function will not do anything.
   **/
  public async setAdminStates(
    owner: HardhatEthersSigner,
    adminAddresses: string[],
    states: boolean[],
  ) {
    const encodedData = ethers.solidityPacked(
      [...adminAddresses.map(() => ['address', 'bool']).flat()],
      [...adminAddresses.map((addr, i) => [addr, states[i]]).flat()],
    );

    await owner.sendTransaction({
      to: this.contract.target,
      data: encodedData,
    });
  }

  /**
   * @param caller - Caller of the function.
   * @param addresses - Addresses of the admins.
   * @param expected - Expected states of the admins.
   **/
  public async checkAdmin(
    caller: HardhatEthersSigner,
    addresses: string[],
    expected: bigint[],
  ) {
    for (const [index, address] of addresses.entries()) {
      const res = await this.isAdmin(caller, address);
      expect(res).to.be.equal(expected[index]);
    }
  }

  /**
   * @param caller - Caller of the function.
   * @param address - Address of the admin.
   * @returns - State of the admin.
   **/
  public async isAdmin(caller: HardhatEthersSigner, address: string) {
    return caller.call({
      to: this.contract.target,
      data: address,
    });
  }
}
