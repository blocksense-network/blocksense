import { getInitialTestAccountsWallets } from '@aztec/accounts/testing';
import {
  AccountWallet,
  CompleteAddress,
  ContractDeployer,
  createPXEClient,
  Fr,
  getContractInstanceFromDeployParams,
  PXE,
  TxStatus,
  waitForPXE,
} from '@aztec/aztec.js';
import { beforeAll, describe, expect, test } from 'vitest';
import {
  HistoricDataFeedStoreContract,
  HistoricDataFeedStoreContractArtifact,
} from '../contracts/historic_data_feed_store/src/artifacts/HistoricDataFeedStore.js';

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
    const dataFeedStoreContractArtifact = HistoricDataFeedStoreContractArtifact;
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

  test('Setting and getting 2 feeds in a single transaction', async () => {
    let keys = [];
    for (let i = 0; i <= 2; i++) {
      keys.push(new Fr(i));
    }
    let values = Array.from(
      { length: 48 },
      () => Math.floor(Math.random() * 256) as number | bigint,
    );
    const contract = await HistoricDataFeedStoreContract.deploy(wallets[0])
      .send()
      .deployed();

    await contract
      .withWallet(wallets[0])
      .methods.set_feeds(keys, values, 2)
      .send()
      .wait();
    const get_first_feed_tx = await contract.methods
      .get_data_feed(keys[0])
      .simulate();
    const get_second_feed_tx = await contract.methods
      .get_data_feed(keys[1])
      .simulate();
    for (let i = 0; i < 24; i++) {
      expect(Number(get_first_feed_tx.value[i])).toEqual(values[i]);
    }
    for (let i = 0; i < 24; i++) {
      expect(Number(get_second_feed_tx.value[i])).toEqual(values[i + 24]);
    }
  }, 30000);
});
