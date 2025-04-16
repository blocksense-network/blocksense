import { task } from 'hardhat/config';
import { Wallet, ethers } from 'ethers';

import Safe from '@safe-global/protocol-kit';
import {
  OperationType,
  SafeTransactionDataPartial,
} from '@safe-global/safe-core-sdk-types';

import { NetworkConfig, ContractNames } from './types';

import { readEvmDeployment, readConfig } from '@blocksense/config-types';
import { encodeDataAndTimestamp } from '../test/utils/helpers/common';
import { Feed, WriteOp } from '../test/utils/wrappers/types';

import { expect } from 'chai';

task(
  'test-deploy',
  'Test deployed contracts (only for localhost: THIS SCRIPT MAKES CHANGES TO THE DEPLOYED CONTRACTS)',
).setAction(async (_, { ethers, run }) => {
  const execMultiSig = (args: { safe: Safe; to: string; data: string }) =>
    run('multisig-tx-exec', {
      config,
      safe: args.safe,
      transactions: [
        {
          to: args.to,
          data: args.data,
          value: '0',
          operation: OperationType.Call,
        },
      ],
    });

  const networkName = 'local';

  const config: NetworkConfig = await run('init-chain', { networkName });

  if (!config.deployWithSequencerMultisig) {
    console.log('Test needs sequencer multisig set!');
    return;
  }

  const { contracts: deployment } = await readEvmDeployment(networkName, true);

  const accessControl = deployment.coreContracts.AccessControl.address;
  const adminMultisigAddr = deployment.AdminMultisig;
  const sequencerMultisigAddr = deployment.SequencerMultisig;

  const adminMultisig = await Safe.init({
    provider: config.rpc,
    safeAddress: adminMultisigAddr,
    signer: config.adminMultisig.signer?.privateKey,
    contractNetworks: {
      [config.network.chainId.toString()]: config.safeAddresses,
    },
  });

  // Public key: 0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199
  const sequencerWallet = new Wallet(
    '0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e',
    config.provider,
  );

  if (!deployment.SequencerMultisig) {
    throw new Error('Sequencer multisig not found in deployment');
  }

  const sequencerMultisig = await Safe.init({
    provider: config.rpc,
    safeAddress: deployment.SequencerMultisig,
    signer: sequencerWallet.privateKey,
    contractNetworks: {
      [config.network.chainId.toString()]: config.safeAddresses,
    },
  });

  // Public key: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
  const reporter = new Wallet(
    '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  );

  // change threshold to 1 for easier testing
  const tx = await adminMultisig.createTransaction({
    transactions: [
      {
        to: deployment.coreContracts.AdminExecutorModule!.address,
        data: (await sequencerMultisig.createChangeThresholdTx(1)).data.data,
        value: '0',
      } as SafeTransactionDataPartial,
    ],
  });
  await adminMultisig.executeTransaction(tx);

  ////////////////////////
  // Write data in ADFS //
  ////////////////////////
  console.log('Writing data in ADFS...');

  const upgradeableProxyAddr =
    deployment.coreContracts.UpgradeableProxyADFS.address;

  let writeTx = await sequencerMultisig.createTransaction({
    transactions: [
      {
        to: upgradeableProxyAddr,
        value: '0',
        data: encodeDataWrite([
          {
            id: 1n,
            stride: 0n,
            index: 1n,
            data: encodeDataAndTimestamp(1234),
          },
        ]),
      },
    ],
  });

  const apiKit = await Safe.init({
    provider: config.rpc,
    safeAddress: await sequencerMultisig.getAddress(),
    signer: reporter.address,
    contractNetworks: {
      [config.network.chainId.toString()]: config.safeAddresses,
    },
  });
  writeTx = await apiKit.signTransaction(writeTx);

  const safeGuard = await ethers.getContractAt(
    ContractNames.OnlySequencerGuard,
    deployment.coreContracts.OnlySequencerGuard!.address,
  );

  const isValidTransaction = await apiKit.isValidTransaction(writeTx);
  // reporters cannot send signed transactions to upgradeable proxy
  // only sequencer can
  expect(isValidTransaction).to.be.false;

  // sequencer cannot send direct transaction to upgradeable proxy
  // AccessControl will reject this transaction
  await expect(sequencerWallet.sendTransaction(writeTx.data)).to.be.reverted;

  await sequencerMultisig.executeTransaction(writeTx);

  ////////////////////////////////////////////
  // Check Aggregator                       //
  ////////////////////////////////////////////
  console.log('Checking Aggregator and Registry adapters...');

  const { feeds } = await readConfig('feeds_config_v2');

  const aggregator = await ethers.getContractAt(
    ContractNames.CLAggregatorAdapter,
    deployment.CLAggregatorAdapter[1].address,
  );

  expect(await aggregator.description()).to.equal(feeds[1].description);
  expect(await aggregator.latestAnswer()).to.equal(1234);

  ////////////////////////////////////////////
  // Check Registry adapter                 //
  ////////////////////////////////////////////
  const feedRegistry = await ethers.getContractAt(
    ContractNames.CLFeedRegistryAdapter,
    deployment.coreContracts.CLFeedRegistryAdapter.address,
    sequencerWallet,
  );

  const registeredFeed = Object.values(deployment.CLAggregatorAdapter).find(
    feed => feed.base && feed.quote,
  );

  if (!registeredFeed) {
    throw new Error(
      'No feed found in deployment config that is registered in Registry',
    );
  }

  const feedFromRegistry = await feedRegistry.getFeed(
    registeredFeed.base!,
    registeredFeed.quote!,
  );

  expect(feedFromRegistry).to.equal(registeredFeed.address);

  ///////////////////////////////////////////
  // Change sequencer rights in Safe Guard //
  ///////////////////////////////////////////
  console.log('Changing sequencer rights in Safe Guard...');

  await execMultiSig({
    safe: adminMultisig,
    to: safeGuard.target.toString(),
    data: safeGuard.interface.encodeFunctionData('setSequencer', [
      reporter.address,
      false,
    ]),
  });

  const writeTxData2: SafeTransactionDataPartial = {
    to: upgradeableProxyAddr,
    value: '0',
    data: encodeDataWrite([
      {
        id: 1n,
        stride: 0n,
        index: 2n,
        data: encodeDataAndTimestamp(5678),
      },
    ]),
  };

  const writeDataTx = await sequencerMultisig.createTransaction({
    transactions: [writeTxData2].map(tx => ({
      ...tx,
      operation: OperationType.Call,
    })),
  });

  await apiKit.executeTransaction(writeDataTx);

  const latestAnswer2 = await aggregator.latestAnswer();
  expect(latestAnswer2).to.equal(5678);

  //////////////////////////////////////
  // Change Access Control admin role //
  //////////////////////////////////////
  console.log('Changing Access Control admin role...');

  const isAllowed = await resolveBool(
    sequencerWallet.call({
      to: accessControl,
      data: sequencerMultisigAddr,
    }),
  );
  expect(isAllowed).to.equal(true);

  await execMultiSig({
    safe: adminMultisig,
    to: accessControl,
    data: ethers.solidityPacked(
      ['address', 'bool'],
      [sequencerMultisigAddr, true],
    ),
  });

  const isAllowedAfter = await resolveBool(
    sequencerWallet.call({
      to: accessControl,
      data: sequencerMultisigAddr,
    }),
  );
  expect(isAllowedAfter).to.equal(false);
});

const resolveBool = (value: Promise<string>) =>
  value.then(x => Boolean(Number(x)));

const encodeDataWrite = (feeds: Feed[], blockNumber?: number) => {
  blockNumber ??= Date.now() + 100;
  const prefix = ethers.solidityPacked(
    ['bytes1', 'uint64', 'uint32'],
    [ethers.toBeHex(WriteOp.SetFeeds), blockNumber, feeds.length],
  );

  const data = feeds.map(feed => {
    const index = (feed.id * 2n ** 13n + feed.index) * 2n ** feed.stride;
    const indexInBytesLength = Math.ceil(index.toString(2).length / 8);
    const bytes = (feed.data.length - 2) / 2;
    const bytesLength = Math.ceil(bytes.toString(2).length / 8);

    return ethers
      .solidityPacked(
        [
          'uint8',
          'uint8',
          `uint${8n * BigInt(indexInBytesLength)}`,
          'uint8',
          `uint${8n * BigInt(bytesLength)}`,
          'bytes',
        ],
        [feed.stride, indexInBytesLength, index, bytesLength, bytes, feed.data],
      )
      .slice(2);
  });

  const batchFeeds: { [key: string]: string } = {};

  feeds.forEach(feed => {
    const rowIndex = ((2n ** 115n * feed.stride + feed.id) / 16n).toString();
    const slotPosition = Number(feed.id % 16n);

    if (!batchFeeds[rowIndex]) {
      // Initialize new row with zeros
      batchFeeds[rowIndex] = '0x' + '0'.repeat(64);
    }

    // Convert index to 2b hex and pad if needed
    const indexHex = feed.index.toString(16).padStart(4, '0');

    // Calculate position in the 32b row (64 hex chars)
    const position = slotPosition * 4;

    // Replace the corresponding 2b in the row
    batchFeeds[rowIndex] =
      batchFeeds[rowIndex].slice(0, position + 2) +
      indexHex +
      batchFeeds[rowIndex].slice(position + 6);
  });

  const indexData = Object.keys(batchFeeds)
    .map(index => {
      const indexInBytesLength = Math.ceil(
        BigInt(index).toString(2).length / 8,
      );

      return ethers
        .solidityPacked(
          ['uint8', `uint${8n * BigInt(indexInBytesLength)}`, 'bytes32'],
          [indexInBytesLength, BigInt(index), batchFeeds[index]],
        )
        .slice(2);
    })
    .join('');

  return prefix.concat(data.join('')).concat(indexData);
};
