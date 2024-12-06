import Web3 from 'web3';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import {
  networkMetadata,
  parseEthereumAddress,
} from '@blocksense/base-utils/evm';
import { deployedNetworks } from '../types';
import { getEnvStringNotAssert } from '@blocksense/base-utils/env';

const getBalance = async (
  address: string,
  networkName: string,
  rpcUrl: string | undefined,
  currency: string,
) => {
  if (!rpcUrl) {
    console.error(chalk.red(`No RPC URL provided for ${networkName}`));
    return;
  }

  try {
    const web3 = new Web3(new Web3.providers.HttpProvider(rpcUrl));
    const balanceWei = await web3.eth.getBalance(address);
    const balance = web3.utils.fromWei(balanceWei, 'ether');
    console.log(chalk.green(`${networkName}: ${balance} ${currency}`));
  } catch (error: unknown) {
    console.error(
      chalk.red(`Error fetching balance for ${networkName}:`),
      error instanceof Error ? error.message : String(error),
    );
  }
};

const main = async (): Promise<void> => {
  const currentSequencerAddress = '0xd756119012CcabBC59910dE0ecEbE406B5b952bE';
  const argv = await yargs(hideBin(process.argv))
    .usage('Usage: $0 [--address <ethereum address>]')
    .option('address', {
      alias: 'a',
      describe: 'Ethereum address to fetch transactions for',
      type: 'string',
      default: currentSequencerAddress,
    })
    .help()
    .alias('help', 'h')
    .parse();

  const address = parseEthereumAddress(argv.address);
  console.log(
    chalk.cyan(
      `Using Ethereum address: ${address} (sequencer: ${
        address === currentSequencerAddress
      })\n`,
    ),
  );

  for (const networkName of deployedNetworks) {
    const metadata = networkMetadata[networkName];
    if (!metadata) {
      console.error(chalk.red(`Metadata not found for ${networkName}`));
      console.error(chalk.red(`Try rebuilding @blocksense/base-utils`));
      continue;
    }
    const { currency } = metadata;

    const rpcUrl = getEnvStringNotAssert(
      `RPC_URL_${networkName.toUpperCase().replace(/-/g, '_')}`,
    );
    if (rpcUrl) {
      await getBalance(address, networkName, rpcUrl, currency || 'UNKNOWN');
    } else {
      console.error(chalk.yellow(`RPC URL not set for ${networkName}`));
    }
  }
};

main().catch(error => {
  console.error(chalk.red('Error running script:'), error.message);
});
