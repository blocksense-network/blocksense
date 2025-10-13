import { spawn } from 'node:child_process';

import { AbiCoder, getAddress, solidityPacked } from 'ethers';
import { task, types } from 'hardhat/config';
import { Artifacts } from 'hardhat/types';

import {
  EthereumAddress,
  parseEthereumAddress,
  parseNetworkName,
} from '@blocksense/base-utils';
import { readEvmDeployment } from '@blocksense/config-types';

import { initChain } from './deployment-utils/init-chain';
import { ContractNames, NetworkConfig } from './types';

task(
  'mine-vanity-address-salt',
  'Mine CREATE2 salt for the ADFS upgradeable proxy vanity address',
)
  .addParam('networkName', 'Network name')
  .addOptionalParam('adminMultisig', 'Custom admin multisig address')
  .addOptionalParam('maxRetries', 'Maximum number of retries', 200, types.int)
  .addOptionalParam('prefix', 'Vanity address prefix', 'ADF5aa')
  .setAction(async (args, { ethers, artifacts }) => {
    await mineVanityAddress({
      config: await initChain(parseNetworkName(args.networkName)),
      adminMultisigAddr: args.adminMultisig
        ? parseEthereumAddress(args.adminMultisig)
        : undefined,
      artifacts,
      prefix: args.prefix,
      maxRetries: args.maxRetries,
    });
  });

export async function mineVanityAddress({
  config,
  adminMultisigAddr,
  artifacts,
  prefix = 'ADF5aa',
  maxRetries = 200,
}: {
  config: NetworkConfig;
  adminMultisigAddr?: EthereumAddress;
  artifacts: Artifacts;
  prefix?: string;
  maxRetries?: number;
}): Promise<{ address: EthereumAddress; salt: string } | null> {
  if (!adminMultisigAddr) {
    console.log(`No multisig address provided, using default`);
    const { contracts } = await readEvmDeployment(config.networkName, true);
    adminMultisigAddr = contracts.safe.AdminMultisig;
  }

  const createCallAddress = config.safeAddresses.createCallAddress;
  const abiCoder = AbiCoder.defaultAbiCoder();
  const encodedArgs = abiCoder.encode(['address'], [adminMultisigAddr]);
  const artifact = artifacts.readArtifactSync(
    ContractNames.UpgradeableProxyADFS,
  );
  const bytecode = solidityPacked(
    ['bytes', 'bytes'],
    [artifact.bytecode, encodedArgs],
  );

  let retries = 0;
  const loader = loadingAnimation(
    () => `Mining address for the ${retries} time…`,
  );
  // Improved async mining loop with enhanced logging and error handling
  while (retries < maxRetries) {
    try {
      const result = await mineOnce(createCallAddress, bytecode, prefix);
      clearInterval(loader);
      // Clear the loader and print the result
      process.stdout.write('\r\x1b[K');
      console.log(`✅ Found a match after ${retries + 1} attempt(s)!`);
      console.log('Checksummed address:', getAddress(result.address));
      console.log('Salt:', result.salt);
      return result;
    } catch (err) {
      retries++;
    }
  }
  clearInterval(loader);
  process.stdout.write('\r\x1b[K');
  console.log('❌ No vanity address found after max retries');
  return null;
}

// Start ERADICATE2 mining process
// This is an ongoing process but most of the time it finds 1 match quickly
// So we will stop it after finding the first match
// If the address does not match the vanity address, it will throw an error
function mineOnce(
  createCallAddress: EthereumAddress,
  bytecode: string,
  prefix: string,
): Promise<{ address: EthereumAddress; salt: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'eradicate2',
      [
        '-A',
        createCallAddress,
        '-I',
        bytecode,
        '--matching',
        prefix.toLowerCase(),
      ],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );

    let found = false;

    child.stdout.on('data', data => {
      const output = data.toString();
      const addressMatch = output.match(/Address:\s*([0-9a-fA-Fx]+)/);
      const saltMatch = output.match(/Salt:\s*([0-9a-fA-Fx]+)/);

      if (addressMatch && saltMatch) {
        const address = parseEthereumAddress(
          getAddress(addressMatch[1].trim()),
        );
        const salt = saltMatch[1].trim();
        if (getAddress(address).includes(prefix)) {
          found = true;
          child.kill();
          resolve({ address, salt });
        } else {
          child.kill();
          reject('No match found');
        }
      }
    });

    child.stderr.on('data', () => {
      child.kill();
      reject('Error occurred while mining vanity address');
    });

    child.on('close', () => {
      if (!found) reject('Mining process closed without finding a match');
    });
  });
}

// Animated loader for user feedback
function loadingAnimation(getText: () => string) {
  const chars = ['⠙', '⠘', '⠰', '⠴', '⠤', '⠦', '⠆', '⠃', '⠋', '⠉'];
  const delay = 100;
  let x = 0;

  return setInterval(function () {
    process.stdout.write('\r' + chars[x++] + ' ' + getText());
    x = x % chars.length;
  }, delay);
}
