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
  AggregatedDataFeedStoreContract,
  AggregatedDataFeedStoreContractArtifact,
} from '../contracts/aggregated_data_feed_store/src/artifacts/AggregatedDataFeedStore.js';

const setupSandbox = async () => {
  const { PXE_URL = 'http://localhost:8080' } = process.env;
  const pxe = createPXEClient(PXE_URL);
  await waitForPXE(pxe);
  return pxe;
};

const feeds = [
  {
    id: 1n,
    round: 6n,
    stride: 1n,
    data: '0x12343267643573',
    slotsToRead: 1,
  },
  {
    id: 2n,
    round: 5n,
    stride: 0n,
    data: '0x2456',
  },
  {
    id: 3n,
    round: 4n,
    stride: 0n,
    data: '0x3678',
  },
  {
    id: 4n,
    round: 3n,
    stride: 0n,
    data: '0x4890',
  },
  {
    id: 5n,
    round: 2n,
    stride: 0n,
    data: '0x5abc',
  },
];

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
    const dataFeedStoreContractArtifact =
      AggregatedDataFeedStoreContractArtifact;
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

  // feed_input_data: [Field; MAX_INPUT_ARRAY_SIZE],
  // block_number: Field,
  // feeds_len: Field,
  // rounds_len: Field
  test('Sets new feeds', async () => {
    const contract = await AggregatedDataFeedStoreContract.deploy(wallets[0])
      .send()
      .deployed();

    const feedInputData = Array.from(
      { length: 33 },
      () => new Fr(Math.floor(Math.random() * 256)),
    );

    const blockNumber = new Fr(100);
    const feedLength = 1;
    const roundsLength = 1;

    await contract
      .withWallet(wallets[0])
      .methods.set_feeds(feedInputData, blockNumber, feedLength, roundsLength)
      .send()
      .wait();
    // const get_first_feed_tx = await contract.methods
    //     .get_data_feed(keys[0])
    //     .simulate();
    // const get_second_feed_tx = await contract.methods
    //     .get_data_feed(keys[1])
    //     .simulate();
    // for (let i = 0; i < 24; i++) {
    //     expect(Number(get_first_feed_tx.value[i])).toEqual(values[i]);
    // }
    // for (let i = 0; i < 24; i++) {
    //     expect(Number(get_second_feed_tx.value[i])).toEqual(values[i + 24]);
    // }
  }, 30000);
});
