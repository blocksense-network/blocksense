import Web3 from 'web3';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import {
  getOptionalRpcUrl,
  networkMetadata,
  parseEthereumAddress,
} from '@blocksense/base-utils/evm';
import { deployedNetworks } from '../types';

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
    const rpcUrl = getOptionalRpcUrl(networkName);
    if (rpcUrl === '') {
      console.log(
        chalk.red(`No rpc url for network ${networkName}. Skipping.`),
      );
      continue;
    }
    const web3 = new Web3(rpcUrl);
    const balanceWei = await web3.eth.getBalance(address);
    const balance = web3.utils.fromWei(balanceWei, 'ether');
    const { currency } = networkMetadata[networkName];
    console.log(chalk.green(`${networkName}: ${balance} ${currency}`));
  }
};

main().catch(error => {
  console.error(chalk.red('Error running script:'), error.message);
});
