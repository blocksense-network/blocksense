import axios, { AxiosResponse } from 'axios';
import Web3 from 'web3';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';

import {
  getOptionalApiKey,
  getOptionalRpcUrl,
  networkMetadata,
  NetworkName,
  parseNetworkName,
  EthereumAddress,
  parseEthereumAddress,
} from '@blocksense/base-utils/evm';
import { getEnvStringNotAssert } from '@blocksense/base-utils/env';

import { Transaction, deployedNetworks } from '../types';

import { decodeADFSCalldata } from '@blocksense/contracts/utils';

const networksUseSecondExplorer: NetworkName[] = [
  'berachain-bepolia',
  'zksync-sepolia',
];

const networksV2Api: NetworkName[] = [
  'morph-holesky',
  'expchain-testnet',
  'metis-sepolia',
  'mezo-matsnet-testnet',
  'songbird-coston',
];

const checkInputDataForLatestUpdatedFeeds = async (
  transaction: Transaction,
  feedsTimespamps: Map<number, Date>,
): Promise<{ updatedFeedTimestamps: Map<number, Date> }> => {
  let updatedFeedTimestamps: Map<number, Date>;

  updatedFeedTimestamps = feedsTimespamps;

  if (transaction.inputData) {
    const transformedInput = decodeADFSCalldata(transaction.inputData);

    for (const feed of transformedInput.feeds) {
      const feedId = Number(feed.feedId);
      updatedFeedTimestamps.set(feedId, new Date(transaction.timestamp));
    }
    return { updatedFeedTimestamps };
  } else {
    return { updatedFeedTimestamps };
  }
};

const fetchTransactionsForNetwork = async (
  network: NetworkName,
  address: EthereumAddress,
  numberOfTransactions: number,
): Promise<{
  transactions: Transaction[];
  firstTxTime: string;
  lastTxTime: string;
}> => {
  const apiUrl = networksUseSecondExplorer.includes(network)
    ? networkMetadata[network].explorers[1]?.apiUrl
    : networkMetadata[network].explorers[0]?.apiUrl;

  const apiKey = getOptionalApiKey(network);
  if (!apiUrl) {
    console.log(chalk.red(`Skipping ${network}: Missing API configuration`));
    return { transactions: [], firstTxTime: '', lastTxTime: '' };
  }

  try {
    console.log('------------------------------------------------------------');
    console.log(chalk.green(network.toUpperCase()));
    console.log(chalk.blue(`Fetching transactions for ${network}...`));
    const rpcUrl = getOptionalRpcUrl(network);
    const web3 = new Web3(rpcUrl);
    const latestBlock = await web3.eth.getBlockNumber();

    let response: AxiosResponse<any>;
    let rawTransactions: any[] = [];
    if (networksV2Api.includes(network)) {
      response = await axios.get(`${apiUrl}/addresses/${address}/transactions`);
      rawTransactions = response.data.items || [];
    } else if (network === 'telos-testnet') {
      response = await axios.get(`${apiUrl}/address/${address}/transactions`);
      rawTransactions = response.data.results || [];
    } else if (network === 'pharos-testnet') {
      response = await axios.get(`${apiUrl}/address/${address}/transactions`);
      rawTransactions = response.data.data || [];
    } else if (network === 'taraxa-testnet') {
      response = await axios.get(
        `${apiUrl}/address/${address}/transactions?limit=100`,
      );
      rawTransactions = response.data.data || [];
    } else if (network === 'ontology-testnet') {
      response = await axios.get(
        `${apiUrl}/addresses/${address}/txs?page_size=20&page_number=1`,
      );
      rawTransactions = response.data.result.records || [];
    } else if (network === 'cronos-testnet') {
      let pageCounter = 1;
      const numOfPages = 30n; //max 10000 blocks per page
      let currentStartBlock = latestBlock - numOfPages * 10000n;
      do {
        const page = await axios.get(apiUrl, {
          params: {
            module: 'account',
            action: 'txlist',
            address,
            startblock: Number(currentStartBlock),
            endblock: Number(currentStartBlock + 10000n),
            apikey: apiKey,
          },
        });
        const txFromPage = page.data.result;
        console.log(
          chalk.blue(
            `Found ${txFromPage.length} transactions on page ${pageCounter}/${numOfPages}`,
          ),
        );
        rawTransactions = rawTransactions.concat(txFromPage);
        currentStartBlock += 10000n;
        pageCounter++;
      } while (currentStartBlock < latestBlock);
    } else if (
      network === 'bitlayer-testnet' ||
      network === 'bitlayer-mainnet'
    ) {
      const chainId =
        network === 'bitlayer-testnet' ? 'BITLAYERTEST' : 'BITLAYER';
      response = await axios.get(
        `${apiUrl}/txs/list?ps=1000&a=${address}&chainId=${chainId}`,
      );
      rawTransactions = response.data.data.records || [];
    } else {
      response = await axios.get(apiUrl, {
        params: {
          module: 'account',
          action: 'txlist',
          address,
          startblock: 0,
          endblock: latestBlock,
          sort: 'desc',
          apikey: apiKey,
        },
      });

      if (response.data.status !== '1') {
        console.error(chalk.red(`${network} Error: ${response.data.message}`));
        return { transactions: [], firstTxTime: '', lastTxTime: '' };
      }
      rawTransactions = response.data.result;
      // console.log(decodeADFSCalldata(rawTransactions[0].input));
    }

    if (network === 'polygon-amoy') {
      // The sort bellow will order the transactions incorrectly if we don't trim them.
      rawTransactions.splice(numberOfTransactions * 2);
    }
    rawTransactions.sort((a, b) => b.nonce - a.nonce);

    let transactions: Transaction[] = rawTransactions
      .filter((tx: any) => tx.result !== 'pending')
      .map(tx => {
        const gasUsed = BigInt(
          tx.gasUsed ?? tx.gas_used ?? tx.gas ?? tx.gasused ?? tx.gasCost ?? 0,
        );

        let fee = tx.txFee ?? tx.fee ?? tx.transaction_fee;
        fee =
          typeof fee === 'string'
            ? BigInt((Number(fee) * 1000000000000000000).toFixed(0))
            : BigInt(0);

        const gasPrice = BigInt(tx.gasPrice ?? tx.gas_price ?? 0);

        let timestamp =
          tx.timestamp?.toString() ??
          tx.blockTime?.toString() ??
          tx.tx_time?.toString() ??
          tx.timeStamp?.toString() ??
          tx.create_time?.toString();
        timestamp = timestamp.includes('T')
          ? new Date(timestamp).getTime()
          : (timestamp = parseInt(timestamp) * 1000);

        const from =
          tx.from?.address ??
          tx.from?.hash ??
          tx.from ??
          tx.from_address ??
          tx.transfers[0]?.from_address;

        const to =
          tx.to?.address ??
          tx.to?.hash ??
          tx.to ??
          tx.to_address ??
          tx.transfers[0]?.to_address;

        return {
          inputData: tx.input,
          from,
          to,
          gasUsed,
          fee,
          gasCost: BigInt(tx.gasCost ?? 0),
          gasPrice,
          timestamp,
        };
      });

    // Filter out self-sent transactions
    transactions = transactions.filter(
      (tx: any) =>
        tx.from.toLowerCase() === address.toLowerCase() &&
        tx.to.toLowerCase() !== address.toLowerCase(),
    );

    transactions.splice(numberOfTransactions);

    let firstTxTimeRet = '';
    let lastTxTimeRet = '';
    if (transactions.length > 0) {
      firstTxTimeRet = new Date(
        transactions[transactions.length - 1].timestamp,
      ).toString();
      lastTxTimeRet = new Date(transactions[0].timestamp).toString();
    }

    console.log(
      chalk.green(
        `${network}: Found ${transactions.length} transactions sent by the account to other addresses`,
      ),
    );
    return {
      transactions,
      firstTxTime: firstTxTimeRet,
      lastTxTime: lastTxTimeRet,
    };
  } catch (error: any) {
    console.error(
      chalk.red(`Error fetching transactions for ${network}: ${error.message}`),
    );
    return { transactions: [], firstTxTime: '', lastTxTime: '' };
  }
};

const DEFAULT_FIRST_TX_TIME = '';
const DEFAULT_LAST_TX_TIME = '';

const main = async (): Promise<void> => {
  const sequencerAddress = getEnvStringNotAssert('SEQUENCER_ADDRESS');
  const argv = await yargs(hideBin(process.argv))
    .usage(
      'Usage: $0 --numberOfTransactions <number> [--address <ethereum address>]',
    )
    .option('address', {
      alias: 'a',
      describe: 'Ethereum address to fetch transactions for',
      type: 'string',
      default: sequencerAddress,
    })
    .option('numberOfTransactions', {
      alias: 'num',
      describe: 'Number of transactions to calculated the cost on',
      type: 'number',
      default: 1000,
    })
    .option('network', {
      alias: 'n',
      describe:
        'Calculate cost only for this network, not all deployed networks',
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

  console.log(
    chalk.cyan(
      `Using Ethereum address: ${address} (sequencer: ${
        address === sequencerAddress
      })\n`,
    ),
  );

  const networks =
    argv.network == '' ? deployedNetworks : [parseNetworkName(argv.network)];

  for (const network of networks) {
    const { transactions } = await fetchTransactionsForNetwork(
      network,
      address,
      argv.numberOfTransactions,
    );
    if (transactions.length > 1) {
      const feedsTimestamps = new Map<number, Date>();
      let counter = 0;
      for (const tx of transactions) {
        counter++;
        checkInputDataForLatestUpdatedFeeds(tx, feedsTimestamps);
      }
      console.log(
        `In the last ${counter} updates we have updated the following feeds:`,
      );
      console.log(feedsTimestamps);
    } else {
      console.log(
        chalk.yellow(
          `${network}: Less than 2 transactions found for the account.`,
        ),
      );
    }
  }
};

main().catch(error => {
  console.error(chalk.red('Error running script:'), error.message);
});
