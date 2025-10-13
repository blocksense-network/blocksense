import { getInitialTestAccountsWallets } from '@aztec/accounts/testing';
import type { AccountWallet, CompleteAddress, PXE } from '@aztec/aztec.js';
import {
  ContractDeployer,
  createPXEClient,
  Fr,
  getContractInstanceFromDeployParams,
  TxStatus,
  waitForPXE,
} from '@aztec/aztec.js';
import { beforeAll, describe, expect, test } from 'vitest';

import {
  DataFeedStoreContract,
  DataFeedStoreContractArtifact,
} from '../contracts/data_feed_store/src/artifacts/DataFeedStore';

const setupSandbox = async () => {
  const { PXE_URL = 'http://localhost:8080' } = process.env;
  const pxe = createPXEClient(PXE_URL);
  await waitForPXE(pxe);
  return pxe;
};

describe('Data feed store contract', () => {
  let pxe: PXE;
  let wallets: AccountWallet[] = [];
  let accounts: CompleteAddress[] = [];

  beforeAll(async () => {
    pxe = await setupSandbox();

    wallets = await getInitialTestAccountsWallets(pxe);
    accounts = wallets.map(w => w.getCompleteAddress());
  });

  test('Deploying the contract', async () => {
    const salt = Fr.random();
    const dataFeedStoreContractArtifact = DataFeedStoreContractArtifact;
    const deployArgs = wallets[0].getCompleteAddress().address;

    const deploymentData = getContractInstanceFromDeployParams(
      dataFeedStoreContractArtifact,
      {
        constructorArgs: [deployArgs],
        salt,
        deployer: wallets[0].getAddress(),
      },
    );

    const deployer = new ContractDeployer(
      dataFeedStoreContractArtifact,
      wallets[0],
    );
    const tx = deployer.deploy(deployArgs).send({ contractAddressSalt: salt });
    const receipt = await tx.getReceipt();

    expect(receipt).toEqual(
      expect.objectContaining({
        status: TxStatus.PENDING,
        error: '',
      }),
    );

    const receiptAfterMined = await tx.wait({ wallet: wallets[0] });

    expect(await pxe.getContractInstance(deploymentData.address)).toBeDefined();
    expect(
      await pxe.isContractPubliclyDeployed(deploymentData.address),
    ).toBeDefined();
    expect(receiptAfterMined).toEqual(
      expect.objectContaining({
        status: TxStatus.SUCCESS,
      }),
    );

    expect(receiptAfterMined.contract.instance.address).toEqual(
      deploymentData.address,
    );
  }, 30000);

  test('Calling the contract when not owner', async () => {
    const index_zero = new Fr(0);
    const data = Array.from(
      { length: 32 },
      () => new Fr(Math.floor(Math.random() * 256)),
    );

    const contract = await DataFeedStoreContract.deploy(wallets[0])
      .send()
      .deployed();

    await expect(
      contract
        .withWallet(wallets[1])
        .methods.setFeed(data, index_zero)
        .send()
        .wait(),
    ).rejects.toThrow('Caller is not the owner!');
  }, 30000);

  test('Setting and getting 10 feeds', async () => {
    const data = Array.from(
      { length: 32 },
      () => new Fr(Math.floor(Math.random() * 256)),
    );

    const contract = await DataFeedStoreContract.deploy(wallets[0])
      .send()
      .deployed();

    for (let i = 0; i < 10; i++) {
      const index_i = new Fr(i);
      await contract.methods.setFeed(data, index_i).send().wait();
      const get_feed_tx = await contract.methods.getFeed(index_i).simulate();
      for (let j = 0; j < 32; j++) {
        expect(Number(get_feed_tx[j])).toEqual(
          parseInt(data[j].value.toString(16), 16),
        );
      }
    }
  }, 100000);
});
