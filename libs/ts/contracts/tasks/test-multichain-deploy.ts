import { task } from 'hardhat/config';
import { Wallet, ethers, solidityPacked, toBeHex } from 'ethers';

import Safe from '@safe-global/protocol-kit';
import { OperationType } from '@safe-global/safe-core-sdk-types';

import { ContractNames } from './types';

import { readEvmDeployment, readConfig } from '@blocksense/config-types';
import { encodeDataAndTimestamp } from '../test/utils/helpers/common';
import { Feed, WriteOp } from '../test/utils/wrappers/types';

import { expect } from 'chai';
import { initChain } from './deployment-utils/init-chain';
import { EthereumAddress } from '@blocksense/base-utils';
import { executeMultisigTransaction } from './deployment-utils/multisig-tx-exec';
import { valuesOf } from '@blocksense/base-utils/array-iter';

task(
  'test-deploy',
  'Test deployed contracts (only for localhost: THIS SCRIPT MAKES CHANGES TO THE DEPLOYED CONTRACTS)',
).setAction(async (_, { ethers, run }) => {
  const execMultisig = (args: { safe: Safe; to: string; data: string }) =>
    executeMultisigTransaction({
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

  const config = await initChain(ethers, networkName);

  const { contracts: deployment } = await readEvmDeployment(networkName, true);

  const adminMultisigAddr = deployment.safe.AdminMultisig;

  const adminMultisig = await Safe.init({
    provider: config.rpc,
    safeAddress: adminMultisigAddr,
    signer: config.deployerIsLedger ? undefined : config.deployer.privateKey,
    contractNetworks: {
      [config.network.chainId.toString()]: config.safeAddresses,
    },
  });

  if (
    config.sequencerAddress !== '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199'
  ) {
    throw new Error(
      'Test needs sequencer address set to 0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199!',
    );
  }

  // Public key: 0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199
  const sequencerWallet = new Wallet(
    '0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e',
    config.provider,
  );

  type ReporterMultisig = {
    signer: Wallet;
    address: string;
    multisig: Safe;
  };
  type SequencerSigner = {
    signer: Wallet;
    address: string;
  };

  const isReporterMultisig = (
    multisig: ReporterMultisig | SequencerSigner,
  ): multisig is ReporterMultisig => {
    return 'multisig' in multisig;
  };

  let writer: ReporterMultisig | SequencerSigner = {
    signer: sequencerWallet,
    address: sequencerWallet.address,
  };

  // Public key: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
  const reporter = new Wallet(
    '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
    config.provider,
  );

  if (deployment.safe.ReporterMultisig && config.deployWithReporterMultisig) {
    const reporterMultisigAddr = deployment.safe.ReporterMultisig;
    const reporterMultisig = await Safe.init({
      provider: config.rpc,
      safeAddress: reporterMultisigAddr,
      signer: sequencerWallet.privateKey,
      contractNetworks: {
        [config.network.chainId.toString()]: config.safeAddresses,
      },
    });

    if (
      !config.reporterMultisig.owners.includes(
        reporter.address as EthereumAddress,
      )
    ) {
      throw new Error(
        'Test needs reporter multisig owner: ' + reporter.address,
      );
    }

    writer = {
      multisig: reporterMultisig,
      address: reporterMultisigAddr,
      signer: reporter,
    };

    // change threshold to 1 for easier testing
    let safeTxChangeThreshold =
      await reporterMultisig.createChangeThresholdTx(1);
    const adminExecutorModule = await ethers.getContractAt(
      'AdminExecutorModule',
      deployment.safe.AdminExecutorModule!.address,
    );

    const isValidExecTx = await reporterMultisig.isValidTransaction(
      safeTxChangeThreshold,
    );
    expect(isValidExecTx).to.be.false;

    await execMultisig({
      safe: adminMultisig,
      to: adminExecutorModule.target.toString(),
      data: (
        await adminExecutorModule.executeTransaction.populateTransaction(
          safeTxChangeThreshold.data.data,
        )
      ).data,
    });
  }

  ////////////////////////
  // Write data in ADFS //
  ////////////////////////
  console.log('Writing data in ADFS...');

  const deployedClAggregatorKey = +Object.keys(
    deployment.CLAggregatorAdapter,
  )[0];

  const upgradeableProxyAddr =
    deployment.coreContracts.UpgradeableProxyADFS.address;

  const txData = {
    to: upgradeableProxyAddr,
    value: '0',
    data: encodeDataWrite([
      {
        id: BigInt(deployedClAggregatorKey),
        stride: 0n,
        index: 1n,
        data: encodeDataAndTimestamp(1234),
      },
    ]),
  };

  if (isReporterMultisig(writer)) {
    let writeTx = await writer.multisig.createTransaction({
      transactions: [txData],
    });

    const reporterMultisigWithReporterSigner = await Safe.init({
      provider: config.rpc,
      safeAddress: writer.address,
      signer: writer.signer.address,
      contractNetworks: {
        [config.network.chainId.toString()]: config.safeAddresses,
      },
    });
    writeTx = await reporterMultisigWithReporterSigner.signTransaction(writeTx);

    const isValidTransaction =
      await reporterMultisigWithReporterSigner.isValidTransaction(writeTx);
    // reporters cannot send signed transactions to upgradeable proxy
    // only sequencer can
    expect(isValidTransaction).to.be.false;

    // sequencer cannot send direct transaction to upgradeable proxy
    // AccessControl will reject this transaction
    await expect(sequencerWallet.sendTransaction(writeTx.data)).to.be.reverted;

    await writer.multisig.executeTransaction(writeTx);
  } else {
    // other signers cannot send direct transaction to upgradeable proxy
    await expect(reporter.sendTransaction(txData)).to.be.reverted;

    const tx = await sequencerWallet.sendTransaction(txData);
    await tx.wait();
  }

  //////////////////////
  // Check Aggregator //
  //////////////////////
  console.log('Checking Aggregator and Registry adapters...');

  const { feeds } = await readConfig('feeds_config_v2');

  const aggregator = await ethers.getContractAt(
    ContractNames.CLAggregatorAdapter,
    deployment.CLAggregatorAdapter[deployedClAggregatorKey].address,
    sequencerWallet,
  );

  expect(await aggregator.description()).to.equal(
    feeds[deployedClAggregatorKey].full_name,
  );
  expect(await aggregator.latestAnswer()).to.equal(1234);

  ////////////////////////////
  // Check Registry adapter //
  ////////////////////////////
  const feedRegistry = await ethers.getContractAt(
    ContractNames.CLFeedRegistryAdapter,
    deployment.coreContracts.CLFeedRegistryAdapter.address,
    sequencerWallet,
  );

  const registeredFeed = valuesOf(deployment.CLAggregatorAdapter).find(
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
  if (isReporterMultisig(writer)) {
    console.log('Changing sequencer rights in Safe Guard...');

    const safeGuard = await ethers.getContractAt(
      ContractNames.OnlySequencerGuard,
      deployment.safe.OnlySequencerGuard!.address,
    );

    await execMultisig({
      safe: adminMultisig,
      to: safeGuard.target.toString(),
      data: safeGuard.interface.encodeFunctionData('setSequencer', [
        reporter.address,
        true,
      ]),
    });
  }

  const txData2 = {
    to: upgradeableProxyAddr,
    value: '0',
    data: encodeDataWrite([
      {
        id: BigInt(deployedClAggregatorKey),
        stride: 0n,
        index: 2n,
        data: encodeDataAndTimestamp(5678),
      },
    ]),
  };

  if (isReporterMultisig(writer)) {
    const reporterMultisigWithReporterSigner = await Safe.init({
      provider: config.rpc,
      safeAddress: writer.address,
      signer: writer.signer.address,
      contractNetworks: {
        [config.network.chainId.toString()]: config.safeAddresses,
      },
    });
    const writeDataTx =
      await reporterMultisigWithReporterSigner.createTransaction({
        transactions: [txData2].map(tx => ({
          ...tx,
          operation: OperationType.Call,
        })),
      });

    await reporterMultisigWithReporterSigner.executeTransaction(writeDataTx);
  } else {
    const tx = await writer.signer.sendTransaction(txData2);
    await tx.wait();
  }

  const latestAnswer2 = await aggregator.latestAnswer();
  expect(latestAnswer2).to.equal(5678);

  //////////////////////////////////////
  // Change Access Control admin role //
  //////////////////////////////////////
  console.log('Changing Access Control admin role...');

  const accessControlAddr = deployment.coreContracts.AccessControl.address;

  const isAllowed = await resolveBool(
    sequencerWallet.call({
      to: accessControlAddr,
      data: writer.address,
    }),
  );
  expect(isAllowed).to.equal(true);

  await execMultisig({
    safe: adminMultisig,
    to: accessControlAddr,
    data: solidityPacked(['address', 'bool'], [writer.address, false]),
  });

  const isAllowedAfter = await resolveBool(
    sequencerWallet.call({
      to: accessControlAddr,
      data: writer.address,
    }),
  );
  expect(isAllowedAfter).to.equal(false);
});

const resolveBool = (value: Promise<string>) =>
  value.then(x => Boolean(Number(x)));

const encodeDataWrite = (feeds: Feed[], blockNumber?: number) => {
  blockNumber ??= Date.now() + 100;
  const prefix = solidityPacked(
    ['bytes1', 'uint64', 'uint32'],
    [toBeHex(WriteOp.SetFeeds), blockNumber, feeds.length],
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
