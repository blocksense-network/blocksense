import Web3 from 'web3';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import client from 'prom-client';
import { color as c } from '@blocksense/base-utils/tty';

import {
  EthereumAddress,
  getOptionalRpcUrl,
  isTestnet,
  parseEthereumAddress,
  parseNetworkName,
} from '@blocksense/base-utils/evm';
import { getEnvStringNotAssert } from '@blocksense/base-utils/env';

import { deployedMainnets, deployedTestnets } from '../types';
import { startPrometheusServer } from '../utils';

const main = async (): Promise<void> => {
  const argv = await yargs(hideBin(process.argv))
    .usage('Usage: $0 [--address <ethereum address>]')
    .option('address', {
      alias: 'a',
      describe: 'Ethereum address to fetch transactions for',
      type: 'string',
      default: '',
    })
    .option('network', {
      alias: 'n',
      describe: 'Check pending tx only for this network',
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
    .option('mainnet', {
      alias: 'm',
      describe: 'Show mainnet pending transactions',
      type: 'boolean',
      default: false,
    })
    .help()
    .alias('help', 'h')
    .parse();

  const parsedNetwork = argv.network ? parseNetworkName(argv.network) : null;
  const shouldUseMainnetSequencer =
    argv.mainnet || (parsedNetwork !== null && !isTestnet(parsedNetwork));

  const sequencerAddress = parseEthereumAddress(
    getEnvStringNotAssert(
      shouldUseMainnetSequencer
        ? 'SEQUENCER_ADDRESS_MAINNET'
        : 'SEQUENCER_ADDRESS_TESTNET',
    ),
  );
  const address: EthereumAddress = sequencerAddress;

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
    c`{cyan Using Ethereum address: ${address} (sequencer: ${
      address === sequencerAddress
    })}\n`,
  );
  const networks =
    argv.network == ''
      ? argv.mainnet
        ? deployedMainnets
        : deployedTestnets
      : [parseNetworkName(argv.network)];

  for (const networkName of networks) {
    const rpcUrl = getOptionalRpcUrl(networkName);
    if (rpcUrl === '') {
      console.log(c`{red No rpc url for network ${networkName}. Skipping.}`);
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
        console.log(c`{red Nonce difference found on ${networkName}:}`);
        console.log(
          c`{red   Latest: ${latestNonce}, Pending: ${pendingNonce}}`,
        );
      } else {
        console.log(c`{green No Nonce difference found on ${networkName}:}`);
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
  console.error(c`{red Error running script:}`, error.message);
});
