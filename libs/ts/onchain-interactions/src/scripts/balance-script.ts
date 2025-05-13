import Web3 from 'web3';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import client from 'prom-client';
import {
  getOptionalRpcUrl,
  networkMetadata,
  parseEthereumAddress,
} from '@blocksense/base-utils/evm';
import { deployedNetworks } from '../types';
import { getEnvStringNotAssert } from '@blocksense/base-utils/env';
import { startPrometheusServer } from '@blocksense/base-utils/prometheus';

const balanceGauge = new client.Gauge({
  name: 'eth_account_balance',
  help: 'Ethereum account balance in Ether',
  labelNames: ['chainId', 'address'],
});

const main = async (): Promise<void> => {
  const sequencerAddress = getEnvStringNotAssert('SEQUENCER_ADDRESS');
  const argv = await yargs(hideBin(process.argv))
    .usage(
      'Usage: $0 [--address <ethereum address>] [--network <name>] [--rpc <url1,url2,...>] [--prometheus] [--host <host>] [--port <port>]',
    )
    .option('address', {
      alias: 'a',
      describe: 'Ethereum address to fetch balance for',
      type: 'string',
      default: sequencerAddress,
    })
    .option('network', {
      alias: 'n',
      describe: 'Use only this network from the deployed list',
      type: 'string',
      default: '',
    })
    .option('rpc', {
      alias: 'r',
      describe: 'Use one or more custom RPC URLs (comma-separated)',
      type: 'string',
      default: '',
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

  if (argv.prometheus) {
    startPrometheusServer(argv.host, argv.port);
  }

  console.log(
    chalk.cyan(
      `Using Ethereum address: ${address} (sequencer: ${
        address === sequencerAddress
      })\n`,
    ),
  );

  if (argv.rpc) {
    const rpcList = argv.rpc
      .split(',')
      .map(url => url.trim())
      .filter(Boolean);

    for (const [index, rpcUrl] of rpcList.entries()) {
      const web3 = new Web3(rpcUrl);
      try {
        const balanceWei = await web3.eth.getBalance(address);
        const balance = Number(web3.utils.fromWei(balanceWei, 'ether'));

        const chainId = Number(await web3.eth.net.getId());
        console.log(
          chalk.green(`${balance} (RPC: ${rpcUrl}) (ChainId: ${chainId})`),
        );
        if (argv.prometheus) {
          balanceGauge.set({ chainId, address }, balance);
        }
      } catch (error) {
        console.error(
          chalk.red(`Failed to fetch balance from (RPC: ${rpcUrl})`),
          (error as Error).message,
        );
      }
    }
    return;
  }

  const networks = argv.network === '' ? deployedNetworks : [argv.network];

  for (const networkName of networks) {
    const rpcUrl = getOptionalRpcUrl(networkName);
    if (rpcUrl === '') {
      console.log(
        chalk.red(`No rpc url for network ${networkName}. Skipping.`),
      );
      continue;
    }
    const web3 = new Web3(rpcUrl);
    try {
      const balanceWei = await web3.eth.getBalance(address);
      const balance = Number(web3.utils.fromWei(balanceWei, 'ether'));
      const chainId = networkMetadata[networkName].chainId;
      const { currency } = networkMetadata[networkName];
      console.log(chalk.green(`${networkName}: ${balance} ${currency}`));
      if (argv.prometheus) {
        balanceGauge.set({ chainId, address }, balance);
      }
    } catch (error) {
      console.error(
        chalk.red(`Failed to fetch balance for ${networkName}:`),
        (error as Error).message,
      );
    }
  }
};

main().catch(error => {
  console.error(chalk.red('Error running script:'), error.message);
});
