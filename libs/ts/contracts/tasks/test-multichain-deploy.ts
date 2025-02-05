import { task } from 'hardhat/config';
import { Artifacts } from 'hardhat/types';
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

import {
  ContractsConfig,
  DeploymentConfig,
} from '@blocksense/config-types/evm-contracts-deployment';
import { encodeDataAndTimestamp } from '../test/utils/helpers/common';
import { Feed } from '../test/utils/wrappers/types';

import { initChain } from './multichain-deploy';

task(
  'test-deploy',
  'Test deployed contracts (only for localhost: THIS SCRIPT MAKES CHANGES TO THE DEPLOYED CONTRACTS)',
).setAction(async (_, { artifacts }) => {
  const network = 'local';
  const config: NetworkConfig = await initChain(network);

  const fileName = 'evm_contracts_deployment_v1';
  const { readJSON } = selectDirectory(configDir);

  const deployedData: DeploymentConfig = await readJSON({ name: fileName });

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

  const sequencerMultisig = await Safe.init({
    provider: config.rpc,
    safeAddress: deployment.SequencerMultisig,
    signer: config.sequencerMultisig.signer.privateKey,
    contractNetworks: {
      [config.network.chainId.toString()]: config.safeAddresses,
    },
  });

  await checkDeployedContracts(
    config,
    deployment,
    artifacts,
    adminMultisig,
    sequencerMultisig,
  );
});

const checkDeployedContracts = async (
  config: NetworkConfig,
  deployedData: ContractsConfig,
  artifacts: Artifacts,
  adminMultisig: Safe,
  sequencerMultisig: Safe,
) => {
  ////////////////////////
  // Write data in ADFS //
  ////////////////////////

  const UP = new ethers.Contract(
    deployedData.coreContracts.UpgradeableProxyADFS.address,
    artifacts.readArtifactSync(ContractNames.UpgradeableProxyADFS).abi,
    config.sequencerMultisig.signer,
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

  for (const owner of config.sequencerMultisig.owners) {
    const apiKit = await Safe.init({
      provider: config.rpc,
      safeAddress: await sequencerMultisig.getAddress(),
      signer: owner,
      contractNetworks: {
        [config.network.chainId.toString()]: config.safeAddresses,
      },
    });
    writeTx = await apiKit.signTransaction(writeTx);
  }

  try {
    const reporter = new Wallet(config.sequencerMultisig.owners[0]);
    const apiKit = await Safe.init({
      provider: config.rpc,
      safeAddress: await sequencerMultisig.getAddress(),
      signer: reporter.address,
      contractNetworks: {
        [config.network.chainId.toString()]: config.safeAddresses,
      },
    });

    await apiKit.executeTransaction(writeTx);
  } catch (err) {
    console.log('[WRONG MULTISIG SENDER] REVERTED AS EXPECTED');
  }

  try {
    await config.sequencerMultisig.signer.sendTransaction(writeTxData);
  } catch (err) {
    console.log('[NOT MULTISIG] REVERTED AS EXPECTED');
  }

  await sequencerMultisig.executeTransaction(writeTx);

  ////////////////////////////////////////////
  // Check Aggregator and Registry adapters //
  ////////////////////////////////////////////

  const PERPAggregator = new ethers.Contract(
    deployedData.CLAggregatorAdapter[1].address,
    artifacts.readArtifactSync(ContractNames.CLAggregatorAdapter).abi,
    config.sequencerMultisig.signer,
  );

  const description = await PERPAggregator.description();
  console.log('description: ' + description + ', expected: PERP / USD');
  const latestAnswer = await PERPAggregator.latestAnswer();
  console.log('latestAnswer: ' + latestAnswer.toString() + ', expected: 1234');

  const feedRegistry = new ethers.Contract(
    deployedData.coreContracts.CLFeedRegistryAdapter.address,
    artifacts.readArtifactSync(ContractNames.CLFeedRegistryAdapter).abi,
    config.sequencerMultisig.signer,
  );

  const feedFromRegistry = await feedRegistry.getFeed(
    '0x3845badAde8e6dFF049820680d1F14bD3903a5d0',
    '0x0000000000000000000000000000000000000348',
  );
  console.log(
    'feed from registry: ' +
      feedFromRegistry.toString() +
      ', expected: ' +
      deployedData.CLAggregatorAdapter[6].address,
  );

  ///////////////////////////////////////////
  // Change sequencer rights in Safe Guard //
  ///////////////////////////////////////////

  const safeGuard = new ethers.Contract(
    deployedData.coreContracts.OnlySequencerGuard.address,
    artifacts.readArtifactSync(ContractNames.OnlySequencerGuard).abi,
    config.sequencerMultisig.signer,
  );

  const reporter = new Wallet(
    '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  );
  const changeSequencerTxData: SafeTransactionDataPartial = {
    to: safeGuard.target.toString(),
    value: '0',
    data: safeGuard.interface.encodeFunctionData('setSequencer', [
      reporter.address,
      true,
    ]),
    operation: OperationType.Call,
  };
  let setSequencerTx = await adminMultisig.createTransaction({
    transactions: [changeSequencerTxData],
  });

  await adminMultisig.executeTransaction(setSequencerTx);

  console.log('Sequencer rights changed');

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

  setSequencerTx = await sequencerMultisig.createTransaction({
    transactions: [writeTxData2].map(tx => ({
      ...tx,
      operation: OperationType.Call,
    })),
  });

  const apiKit = await Safe.init({
    provider: config.rpc,
    safeAddress: await sequencerMultisig.getAddress(),
    signer: reporter.address,
    contractNetworks: {
      [config.network.chainId.toString()]: config.safeAddresses,
    },
  });
  await apiKit.executeTransaction(setSequencerTx);

  const latestAnswer2 = await PERPAggregator.latestAnswer();
  console.log('latestAnswer: ' + latestAnswer2.toString() + ', expected: 5678');

  //////////////////////////////////////
  // Change Access Control admin role //
  //////////////////////////////////////

  const accessControl = new ethers.Contract(
    deployedData.coreContracts.AccessControl.address,
    artifacts.readArtifactSync(ContractNames.AccessControl).abi,
    config.sequencerMultisig.signer,
  );

  const isAllowed = await config.sequencerMultisig.signer.call({
    to: accessControl.target.toString(),
    data: await sequencerMultisig.getAddress(),
  });
  console.log('isAllowed: ' + Boolean(Number(isAllowed)) + ', expected: true');

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

  const isAllowedAfter = await config.sequencerMultisig.signer.call({
    to: accessControl.target.toString(),
    data: await sequencerMultisig.getAddress(),
  });
  console.log(
    'isAllowedAfter: ' + Boolean(Number(isAllowedAfter)) + ', expected: false',
  );
};

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
