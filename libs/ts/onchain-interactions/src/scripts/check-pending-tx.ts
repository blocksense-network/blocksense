import chalk from 'chalk';
import Web3 from 'web3';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import client from 'prom-client';

import {
  getOptionalRpcUrl,
  parseEthereumAddress,
} from '@blocksense/base-utils/evm';
import { getEnvStringNotAssert } from '@blocksense/base-utils/env';

import { deployedNetworks } from '../types';
import { startPrometheusServer } from '../utils';

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
    .option('prometheus', {
      alias: 'p',
      describe: 'Enable Prometheus metrics recording',
      type: 'boolean',
      default: false,
    })
    .option('host', {
      describe: 'Host to bind Prometheus metrics server',
      type: 'string',
      default: '0.0.0.0',
    })
    .option('port', {
      describe: 'Port to expose Prometheus metrics server',
      type: 'number',
      default: 9100,
    })
    .help()
    .alias('help', 'h')
    .parse();

  const address = parseEthereumAddress(argv.address);
  let pendingGauge: client.Gauge | null = null;

  if (argv.prometheus) {
    startPrometheusServer(argv.host, argv.port);
    pendingGauge = new client.Gauge({
      name: 'eth_account_pending',
      help: 'How many pending transactions this account has',
      labelNames: ['networkName', 'address'],
    });
  }

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
      const nonceDifference = Number(pendingNonce - latestNonce);

      if (pendingGauge) {
        pendingGauge.set({ networkName, address }, nonceDifference);
      }

      if (nonceDifference) {
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
