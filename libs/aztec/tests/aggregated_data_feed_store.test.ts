import {
  AccountManager,
  AccountWallet,
  CompleteAddress,
  ContractDeployer,
  createLogger,
  Fr,
  PXE,
  waitForPXE,
  TxStatus,
  createPXEClient,
  getContractInstanceFromDeployParams,
  Logger,
} from '@aztec/aztec.js';
import {
  getInitialTestAccountsWallets,
  generateSchnorrAccounts,
} from '@aztec/accounts/testing';
// import { spawn } from 'child_process';
// import { SponsoredFeePaymentMethod } from './sponsored_fee_payment_method.js';

import {
  AggregatedDataFeedStoreContract,
  AggregatedDataFeedStoreContractArtifact,
} from '../src/artifacts/AggregatedDataFeedStore.js';

import { beforeAll, describe, expect, test } from 'vitest';

const setupSandbox = async () => {
  const { PXE_URL = 'http://localhost:8080' } = process.env;
  const pxe = createPXEClient(PXE_URL);
  await waitForPXE(pxe);
  return pxe;
};
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const ZERO = 0n;
const ONE = 1;
const TWO = 2;
const THREE = 3;
const MAX_ROUNDS_SIZE_FOR_STRIDE_0 = 4;
const MAX_ROUND_VALUES_IN_A_FIELD = 15;
const ROUND_SIZE_IN_BITS = 16;
const MAX_FEEDS_SIZE_FOR_STRIDE_0 = 58;
const TWO_POW_16 = 65536; // 2^16
const TWO_POW_126 = 0x40000000000000000000000000000000n;
const TWO_POW_115 = BigInt(2) ** BigInt(115);
const ROUND_VALUE_MAX_BITS_SIZE = 65536n;

function getLatestRound(stride: bigint, feedId: bigint): bigint {
  const id = (feedId % BigInt(15)) + BigInt(1);
  console.log('id: ', id);
  const pos = BigInt(240) - BigInt(16) * id;
  const twoPowPos = BigInt(2) ** pos; // 2^pos
  console.log('pos: ', pos);
  console.log('twoPowPos: ', twoPowPos);

  let roundValue = 0n;
  if (feedId < 15) {
    roundValue =
      0x0000000100020003000400050006000700080000000000000000000000010002n;
  } else if (feedId >= 15 && feedId < 30) {
    roundValue =
      0x0000000100020003000400050006000700080000000000000000000000010002n;
  } else if (feedId >= 30 && feedId < 45) {
    roundValue =
      0x0000000100020003000400050006000700080000000000000000000000010002n;
  } else if (feedId >= 45) {
    roundValue =
      0x0000000100020003000400050006000700080000000000000000000000010002n;
  }

  const shifted = roundValue / twoPowPos;
  console.log('shifted: ', shifted);
  const round = shifted % ROUND_VALUE_MAX_BITS_SIZE;

  return BigInt(round);
}

const TWO_POW_128 = BigInt(2) ** BigInt(128);
const TWO_POW_13 = BigInt(2) ** BigInt(13);

function pow(base: bigint, exp: bigint): bigint {
  return base ** exp;
}

function calculateFeedIndex(
  feedId: bigint,
  round: bigint,
  stride: bigint,
): bigint {
  return (
    TWO_POW_128 * pow(BigInt(2), stride) +
    feedId * TWO_POW_13 * pow(BigInt(2), stride) +
    round * pow(BigInt(2), stride)
  );
}

const _58_DATA_FEEDS_STRIDE_0 = [
  // Feeds
  calculateFeedIndex(BigInt(16), BigInt(0), BigInt(0)),
  ONE,
  123,
  calculateFeedIndex(BigInt(16), BigInt(1), BigInt(0)),
  ONE,
  456,
  calculateFeedIndex(BigInt(16), BigInt(2), BigInt(0)),
  ONE,
  789,
  // Rounds
  0,
  0x0000000100020003000400050006000700080000000000000000000000010002n,
  1,
  0x0000000100020003000400050006000700080000000000000000000000010002n,
  2,
  0x0000000100020003000400050006000700080000000000000000000000010002n,
  3,
  0x0000000100020003000400050006000700080000000000000000000000010002n,
].map(x => new Fr(x));

describe('Reading from/Writing to storage', () => {
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
    const aggregatedDataFeedStoreContractArtifact =
      AggregatedDataFeedStoreContractArtifact;
    const deployArgs = wallets[0].getCompleteAddress().address;

    const deploymentData = getContractInstanceFromDeployParams(
      aggregatedDataFeedStoreContractArtifact,
      {
        constructorArgs: [deployArgs],
        salt,
        deployer: wallets[0].getAddress(),
      },
    );

    const deployer = new ContractDeployer(
      aggregatedDataFeedStoreContractArtifact,
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

    expect(
      await pxe.getContractMetadata((await deploymentData).address),
    ).toBeDefined();
    expect(
      (await pxe.getContractMetadata((await deploymentData).address))
        .contractInstance,
    ).toBeTruthy();
    expect(receiptAfterMined).toEqual(
      expect.objectContaining({
        status: TxStatus.SUCCESS,
      }),
    );

    console.log(receiptAfterMined.contract.instance.address);

    expect(receiptAfterMined.contract.instance.address).toEqual(
      (await deploymentData).address,
    );
  }, 30000);

  test.only('Sets new feeds', async () => {
    const contract = await AggregatedDataFeedStoreContract.deploy(wallets[0])
      .send()
      .deployed();

    const feedsLen = 3;
    const roundLen = 4;
    const blockNumber = 4;
    await contract
      .withWallet(wallets[0])
      .methods.set_feeds(
        _58_DATA_FEEDS_STRIDE_0,
        feedsLen,
        roundLen,
        blockNumber,
      )
      .send()
      .wait();

    let feed_id = 16;
    let feedAtRound = await contract
      .withWallet(wallets[0])
      .methods.get_feed_at_round(feed_id, 0, ZERO)
      .send()
      .wait();
    let _feedAtRound = await contract
      .withWallet(wallets[0])
      .methods.get_feed_at_round(feed_id, 1, ZERO)
      .send()
      .wait();

    let latestRound = await contract
      .withWallet(wallets[0])
      .methods.get_latest_round(ZERO, feed_id)
      .send()
      .wait();

    let latestData = await contract
      .withWallet(wallets[0])
      .methods.get_latest_data(ZERO, feed_id)
      .send()
      .wait();
  }, 30000);
});
