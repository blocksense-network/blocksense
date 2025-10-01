import Web3 from 'web3';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { color as c } from '@blocksense/base-utils/tty';
import client from 'prom-client';

import {
  getNetworkNameByChainId,
  getOptionalRpcUrl,
  networkMetadata,
  parseEthereumAddress,
  isChainId,
  parseNetworkName,
  isTestnet,
  EthereumAddress,
} from '@blocksense/base-utils/evm';
import { getEnvStringNotAssert } from '@blocksense/base-utils/env';

import { deployedMainnets, deployedTestnets } from '../types';
import { startPrometheusServer } from '../utils';

function filterSmallBalance(balance: string, threshold = 1e-6): number {
  return Number(balance) < threshold ? 0 : Number(balance);
}

const main = async (): Promise<void> => {
  const argv = await yargs(hideBin(process.argv))
    .usage(
      'Usage: $0 [--address <ethereum address>] [--network <name>] [--rpc <url1,url2,...>] [--prometheus] [--host <host>] [--port <port>]',
    )
    .option('address', {
      alias: 'a',
      describe: 'Ethereum address to fetch balance for',
      type: 'string',
      default: '',
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
    .option('mainnet', {
      alias: 'm',
      describe: 'Show mainnet balances',
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

  const address: EthereumAddress = argv.address
    ? parseEthereumAddress(argv.address)
    : sequencerAddress;

  let balanceGauge: client.Gauge | null = null;

  if (argv.prometheus) {
    startPrometheusServer(argv.host, argv.port);
    balanceGauge = new client.Gauge({
      name: 'eth_account_balance',
      help: 'Ethereum account balance in native token',
      labelNames: ['networkName', 'address', 'rpcUrl'],
    });
  }

  console.log(
    c`{cyan Using Ethereum address: ${address} (sequencer: ${
      address === sequencerAddress
    })}\n`,
  );

  if (argv.rpc) {
    const rpcList = argv.rpc
      .split(',')
      .map(url => url.trim())
      .filter(Boolean);

    for (const rpcUrl of rpcList) {
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
          networkName === 'unknown'
            ? c`{red ${message}}`
            : c`{green ${message}}`,
        );

        if (balanceGauge) {
          balanceGauge.set(
            { networkName, address, rpcUrl },
            filterSmallBalance(balance),
          );
        }
      } catch (error) {
        console.error(
          c`{red Failed to fetch balance from (RPC: ${rpcUrl})}`,
          (error as Error).message,
        );
      }
    }
    return;
  }

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
    }
    const web3 = new Web3(rpcUrl);
    try {
      const balanceWei = await web3.eth.getBalance(address);
      const balance = web3.utils.fromWei(balanceWei, 'ether');
      const { currency } = networkMetadata[networkName];
      console.log(
        balanceWei === 0n
          ? c`{grey ${networkName}: ${balance} ${currency}}`
          : c`{green ${networkName}: ${balance} ${currency}}`,
      );
      if (balanceGauge) {
        balanceGauge.set(
          { networkName, address, rpcUrl },
          filterSmallBalance(balance),
        );
      }
    } catch (error) {
      console.error(
        c`{red Failed to fetch balance for ${networkName}:}`,
        (error as Error).message,
      );
    }
  }
};

main().catch(error => {
  console.error(c`{red Error running script:}`, error.message);
});
