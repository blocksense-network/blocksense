import { task } from 'hardhat/config';
import { Wallet, ethers } from 'ethers';

import Safe from '@safe-global/protocol-kit';
import {
  OperationType,
  SafeTransactionDataPartial,
} from '@safe-global/safe-core-sdk-types';

import { NetworkConfig, ContractNames } from './types';
import {
  getNetworkNameByChainId,
  parseChainId,
} from '@blocksense/base-utils/evm';

import { configDir } from '@blocksense/base-utils/env';
import { selectDirectory } from '@blocksense/base-utils/fs';

import { DeploymentConfigV2 } from '@blocksense/config-types/evm-contracts-deployment';
import { encodeDataAndTimestamp } from '../test/utils/helpers/common';
import { Feed } from '../test/utils/wrappers/types';

import { initChain } from './multichain-deploy';
import { expect } from 'chai';

task(
  'test-deploy',
  'Test deployed contracts (only for localhost: THIS SCRIPT MAKES CHANGES TO THE DEPLOYED CONTRACTS)',
).setAction(async (_, hre) => {
  const network = 'local';
  const config: NetworkConfig = await initChain(network);

  if (!config.deployWithSequencerMultisig) {
    console.log('Test needs sequencer multisig set!');
    return;
  }

  const fileName = 'evm_contracts_deployment_v2';
  const { readJSON } = selectDirectory(configDir);

  const deployedData: DeploymentConfigV2 = await readJSON({ name: fileName });

  const networkName = getNetworkNameByChainId(
    parseChainId(config.network.chainId),
  );

  const deployment = deployedData[networkName]?.contracts!;

  const adminMultisig = await Safe.init({
    provider: config.rpc,
    safeAddress: deployment.AdminMultisig,
    signer: config.adminMultisig.signer.privateKey,
    contractNetworks: {
      [config.network.chainId.toString()]: config.safeAddresses,
    },
  });

  // Public key: 0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199
  const sequencerWallet = new Wallet(
    '0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e',
    config.provider,
  );

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
  let safeTxChangeThreshold =
    await sequencerMultisig.createChangeThresholdTx(1);

  for (const owner of config.sequencerMultisig.owners) {
    const apiKit = await Safe.init({
      provider: config.rpc,
      safeAddress: await sequencerMultisig.getAddress(),
      signer: owner,
      contractNetworks: {
        [config.network.chainId.toString()]: config.safeAddresses,
      },
    });
    safeTxChangeThreshold = await apiKit.signTransaction(safeTxChangeThreshold);
  }

  await sequencerMultisig.executeTransaction(safeTxChangeThreshold);

  ////////////////////////
  // Write data in ADFS //
  ////////////////////////
  console.log('Writing data in ADFS...');

  const UP = await hre.ethers.getContractAt(
    ContractNames.UpgradeableProxyADFS,
    deployment.coreContracts.UpgradeableProxyADFS.address,
  );

  const feed: Feed = {
    id: 1n,
    stride: 0n,
    round: 1n,
    data: encodeDataAndTimestamp(1234),
  };

  const writeTxData: SafeTransactionDataPartial = {
    to: UP.target.toString(),
    value: '0',
    data: encodeDataWrite([feed]),
  };

  let writeTx = await sequencerMultisig.createTransaction({
    transactions: [writeTxData],
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

  const safeGuard = await hre.ethers.getContractAt(
    ContractNames.OnlySequencerGuard,
    deployment.coreContracts.OnlySequencerGuard.address,
  );

  // reporters cannot send signed transactions to upgradeable proxy
  // only sequencer can
  await expect(
    apiKit.executeTransaction(writeTx),
  ).to.be.revertedWithCustomError(safeGuard, 'ExecutorNotSequencer');

  // sequencer cannot send direct transaction to upgradeable proxy
  // AccessControl will reject this transaction
  await expect(sequencerWallet.sendTransaction(writeTxData)).to.be.reverted;

  await sequencerMultisig.executeTransaction(writeTx);

  ////////////////////////////////////////////
  // Check Aggregator and Registry adapters //
  ////////////////////////////////////////////
  console.log('Checking Aggregator and Registry adapters...');

  const aggregator = await hre.ethers.getContractAt(
    ContractNames.CLAggregatorAdapter,
    deployment.CLAggregatorAdapter[1].address,
    sequencerWallet,
  );

  const description = await aggregator.description();
  expect(description).to.equal('MLN / ETH');
  const latestAnswer = await aggregator.latestAnswer();
  expect(latestAnswer).to.equal(1234);

  const feedRegistry = await hre.ethers.getContractAt(
    ContractNames.CLFeedRegistryAdapter,
    deployment.coreContracts.CLFeedRegistryAdapter.address,
    sequencerWallet,
  );

  const feedFromRegistry = await feedRegistry.getFeed(
    '0xec67005c4E498Ec7f55E092bd1d35cbC47C91892',
    '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  );

  expect(feedFromRegistry).to.equal(deployment.CLAggregatorAdapter[1].address);

  ///////////////////////////////////////////
  // Change sequencer rights in Safe Guard //
  ///////////////////////////////////////////
  console.log('Changing sequencer rights in Safe Guard...');

  const changeSequencerTxData: SafeTransactionDataPartial = {
    to: safeGuard.target.toString(),
    value: '0',
    data: safeGuard.interface.encodeFunctionData('setSequencer', [
      reporter.address,
      true,
    ]),
    operation: OperationType.Call,
  };
  const setSequencerTx = await adminMultisig.createTransaction({
    transactions: [changeSequencerTxData],
  });

  await adminMultisig.executeTransaction(setSequencerTx);

  const newFeed: Feed = {
    id: 1n,
    stride: 0n,
    round: 2n,
    data: encodeDataAndTimestamp(5678),
  };

  const writeTxData2: SafeTransactionDataPartial = {
    to: UP.target.toString(),
    value: '0',
    data: encodeDataWrite([newFeed]),
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

  const accessControl = await hre.ethers.getContractAt(
    ContractNames.AccessControl,
    deployment.coreContracts.AccessControl.address,
  );

  const isAllowed = Boolean(
    Number(
      await sequencerWallet.call({
        to: accessControl.target.toString(),
        data: await sequencerMultisig.getAddress(),
      }),
    ),
  );
  expect(isAllowed).to.equal(true);

  const changeAccessControlTxData: SafeTransactionDataPartial = {
    to: accessControl.target.toString(),
    value: '0',
    data: ethers.solidityPacked(
      ['address', 'bool'],
      [await sequencerMultisig.getAddress(), false],
    ),
    operation: OperationType.Call,
  };

  let changeAccessControlTx = await adminMultisig.createTransaction({
    transactions: [changeAccessControlTxData],
  });

  await adminMultisig.executeTransaction(changeAccessControlTx);

  const isAllowedAfter = Boolean(
    Number(
      await sequencerWallet.call({
        to: accessControl.target.toString(),
        data: await sequencerMultisig.getAddress(),
      }),
    ),
  );
  expect(isAllowedAfter).to.equal(false);
});

const encodeDataWrite = (feeds: Feed[], blockNumber?: number) => {
  blockNumber ??= Date.now() + 100;
  const prefix = ethers.solidityPacked(
    ['bytes1', 'uint64', 'uint32'],
    ['0x00', blockNumber, feeds.length],
  );

  const data = feeds.map(feed => {
    const index = (feed.id * 2n ** 13n + feed.round) * 2n ** feed.stride;
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

    // Convert round to 2b hex and pad if needed
    const roundHex = feed.round.toString(16).padStart(4, '0');

    // Calculate position in the 32b row (64 hex chars)
    const position = slotPosition * 4;

    // Replace the corresponding 2b in the row
    batchFeeds[rowIndex] =
      batchFeeds[rowIndex].slice(0, position + 2) +
      roundHex +
      batchFeeds[rowIndex].slice(position + 6);
  });

  const roundData = Object.keys(batchFeeds)
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

  return prefix.concat(data.join('')).concat(roundData);
};
