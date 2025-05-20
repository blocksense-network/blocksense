import { task } from 'hardhat/config';

import Safe from '@safe-global/protocol-kit';

import {
  parseNetworkName,
  EthereumAddress,
  parseEthereumAddress,
} from '@blocksense/base-utils';
import { readEvmDeployment } from '@blocksense/config-types';

import { initChain } from './deployment-utils/init-chain';
import { executeMultisigTransaction } from './deployment-utils/multisig-tx-exec';
import { NetworkConfig } from './types';
import {
  color as c,
  drawBox,
  readline,
  renderTui,
  vlist,
} from '@blocksense/base-utils/tty';

task('add-signer-to-multisig', 'Add signer to multisig')
  .addParam('adminMultisig', 'Custom admin multisig address')
  .addParam('newSigner', 'New signer address')
  .addParam('networkName', 'Network name')
  .setAction(async (args, { ethers }) => {
    await addSignerToMultisig({
      config: await initChain(ethers, parseNetworkName(args.networkName)),
      adminMultisigAddr: parseEthereumAddress(args.adminMultisig),
      newAddress: args.newSigner,
    });
  });

export async function addSignerToMultisig({
  config,
  adminMultisigAddr,
  newAddress,
}: {
  config: NetworkConfig;
  adminMultisigAddr?: EthereumAddress;
  newAddress: EthereumAddress;
}) {
  const { networkName } = config;

  if (!adminMultisigAddr) {
    console.log(`No multisig address provided, using default`);
    const { contracts } = await readEvmDeployment(networkName, true);
    adminMultisigAddr = contracts.safe.AdminMultisig;
  }

  const signer = config.deployerIsLedger
    ? undefined
    : config.deployer.privateKey;

  const adminMultisig = await Safe.init({
    provider: config.rpc,
    signer,
    safeAddress: adminMultisigAddr,
    contractNetworks: {
      [config.network.chainId.toString()]: config.safeAddresses,
    },
  });

  const signersBefore = await adminMultisig.getOwners();
  const threshold = await adminMultisig.getThreshold();

  renderTui(
    drawBox(
      'Add signer to multisig',
      drawBox(
        `ADMIN Multisig config`,
        c`Address: {bold ${adminMultisigAddr}}`,
        c`Threshold: {bold ${threshold} / ${signersBefore.length}}`,
        `Signers: `,
        ...vlist(signersBefore),
      ),
      drawBox('New signer', `Address: ${newAddress}`),
    ),
  );

  if (!signersBefore.includes(config.deployerAddress)) {
    console.log(`Deployer address ${config.deployerAddress} is not a signer`);
    return;
  }

  if (threshold != 1) {
    console.log(`Unexpected multisig threshold: ${threshold}, expected 1`);
    return;
  }

  if (signersBefore.includes(newAddress)) {
    console.log('Signer already exists');
    return;
  }

  if (
    (await readline().question(
      `\nAre you sure you want to add ${newAddress} as a signer? (y/n) `,
    )) !== 'y'
  ) {
    console.log('Aborting...');
    return;
  }

  console.log('\n[ADMIN MULTISIG] Adding new signer...');

  const tx = await adminMultisig.createAddOwnerTx({
    ownerAddress: newAddress,
  });

  await executeMultisigTransaction({
    transactions: [tx.data],
    safe: adminMultisig,
    config,
  });

  const signersAfter = await adminMultisig.getOwners();

  renderTui(
    drawBox(
      'Signer added',
      drawBox(
        `ADMIN Multisig config`,
        c`Address: {bold ${adminMultisigAddr}}`,
        c`Threshold: {bold ${threshold} / ${signersAfter.length}}`,
        `Signers: `,
        ...vlist(signersAfter),
      ),
    ),
  );
}
