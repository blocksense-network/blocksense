import {
  getOptionalRpcUrl,
  parseEthereumAddress,
} from '@blocksense/base-utils/evm';
import chalk from 'chalk';
import Web3 from 'web3';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { deployedNetworks } from '../types';
import { getEnvStringNotAssert } from '@blocksense/base-utils/env';

const main = async (): Promise<void> => {
  const sequencerAddress = getEnvStringNotAssert('SEQUENCER_ADDRESS');
  const argv = await yargs(hideBin(process.argv))
    .usage('Usage: $0 [--address <ethereum address>]')
    .option('address', {
      alias: 'a',
      describe: 'Ethereum address to fetch transactions for',
      type: 'string',
      default: sequencerAddress,
    })
    .help()
    .alias('help', 'h')
    .parse();

  const address = parseEthereumAddress(argv.address);
  console.log(
    chalk.cyan(
      `Using Ethereum address: ${address} (sequencer: ${
        address === sequencerAddress
      })\n`,
    ),
  );

  for (const networkName of deployedNetworks) {
    const rpcUrl = getOptionalRpcUrl(networkName);
    if (rpcUrl === '') {
      console.log(
        chalk.red(`No rpc url for network ${networkName}. Skipping.`),
      );
      continue;
    }
    try {
      const web3 = new Web3(rpcUrl);

      const latestNonce = await web3.eth.getTransactionCount(address, 'latest');
      const pendingNonce = await web3.eth.getTransactionCount(
        address,
        'pending',
      );

      if (latestNonce !== pendingNonce) {
        console.log(chalk.red(`Nonce difference found on ${networkName}:`));
        console.log(
          chalk.red(`  Latest: ${latestNonce}, Pending: ${pendingNonce}`),
        );
      } else {
        console.log(
          chalk.green(`No Nonce difference found on ${networkName}:`),
        );
      }
    } catch (error) {
      console.error(
        `Error checking network ${networkName}:`,
        (error as Error).message,
      );
    }
  }
};

main().catch(error => {
  console.error(chalk.red('Error running script:'), error.message);
});
