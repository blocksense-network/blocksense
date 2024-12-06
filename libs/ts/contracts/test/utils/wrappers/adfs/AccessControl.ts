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

  public async set(signer: HardhatEthersSigner, addresses: string[]) {
    const encodedData = ethers.solidityPacked(
      [...addresses.map(() => 'address')],
      [...addresses],
    );

    await signer.sendTransaction({
      to: this.contract.target,
      data: encodedData,
    });
  }

  public async checkAdmin(
    signer: HardhatEthersSigner,
    addresses: string[],
    expected: bigint[],
  ) {
    for (const [index, address] of addresses.entries()) {
      const res = await this.isAdmin(signer, address);
      expect(res).to.be.equal(expected[index]);
    }
  }

  public async isAdmin(signer: HardhatEthersSigner, address: string) {
    return signer.call({
      to: this.contract.target,
      data: address,
    });
  }
}
