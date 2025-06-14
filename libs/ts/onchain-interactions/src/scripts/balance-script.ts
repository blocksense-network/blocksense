import Web3 from 'web3';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import {
  getNetworkNameByChainId,
  getOptionalRpcUrl,
  networkMetadata,
  parseEthereumAddress,
  isChainId,
} from '@blocksense/base-utils/evm';
import { deployedNetworks } from '../types';
import { getEnvStringNotAssert } from '@blocksense/base-utils/env';
import client from 'prom-client';
import express from 'express';

const balanceGauge = new client.Gauge({
  name: 'eth_account_balance',
  help: 'Ethereum account balance in Ether',
  labelNames: ['networkName', 'address', 'rpcUrl'],
});

function filterSmallBalance(balance: string, threshold = 1e-6): number {
  return Number(balance) < threshold ? 0 : Number(balance);
}
const startPrometheusServer = (host: string, port: number): void => {
  const app = express();
  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  });
  app.listen(port, host, () => {
    console.log(
      chalk.blue(
        `Prometheus metrics exposed at http://${host}:${port}/metrics`,
      ),
    );
  });
};

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
        const balance = web3.utils.fromWei(balanceWei, 'ether');

        const chainId = Number(await web3.eth.net.getId());
        const networkName = isChainId(chainId)
          ? getNetworkNameByChainId(chainId)
          : 'unknown';

        const message = `${balance} (RPC: ${rpcUrl}) (NetworkName: ${networkName})`;

        console.log(
          networkName === 'unknown' ? chalk.red(message) : chalk.green(message),
        );

        if (argv.prometheus) {
          balanceGauge.set(
            { networkName, address, rpcUrl },
            filterSmallBalance(balance),
          );
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
    }
    const web3 = new Web3(rpcUrl);
    try {
      const balanceWei = await web3.eth.getBalance(address);
      const balance = web3.utils.fromWei(balanceWei, 'ether');
      const chainId = networkMetadata[networkName].chainId;
      const { currency } = networkMetadata[networkName];
      console.log(chalk.green(`${networkName}: ${balance} ${currency}`));
      if (argv.prometheus) {
        balanceGauge.set(
          { networkName, address, rpcUrl },
          filterSmallBalance(balance),
        );
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
