import axios, { AxiosResponse } from 'axios';
import Web3 from 'web3';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { color as c } from '@blocksense/base-utils/tty';
import client from 'prom-client';

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
import { throwError } from '@blocksense/base-utils/errors';

import { Transaction, deployedNetworks } from '../types';
import { startPrometheusServer } from '../utils';

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

type Gauges = {
  gasCost: client.Gauge;
  cost: client.Gauge;
  balance: client.Gauge;
  daysLeft: client.Gauge;
  transactionsCount: client.Gauge;
  transactionsPeriod: client.Gauge;
};

function filterSmallBalance(balance: string, threshold = 1e-6): number {
  return Number(balance) < threshold ? 0 : Number(balance);
}

function getHourDifference(transactions: Transaction[]): number {
  const txsLen = transactions.length;
  if (txsLen < 2) {
    throwError('Less then 2 transactions in getHourDifference');
  }
  const firstTransactionTime = new Date(transactions[0].timestamp);
  const lastTransactionTime = new Date(transactions[txsLen - 1].timestamp);

  const diffMs = firstTransactionTime.getTime() - lastTransactionTime.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  return diffHours;
}

const calculateGasCosts = (
  hoursBetweenFirstLastTx: number,
  transactions: Transaction[],
): {
  avgGasPriceGwei: string;
  cost1h: number;
  gasUsed1h: number;
} => {
  if (transactions.length < 2) {
    throwError('Less then 2 transactions in calculateGasCosts');
  }
  let totalGasCost = BigInt(0);
  let totalGasPrice = BigInt(0);
  let totalGasUsed = BigInt(0);

  for (const tx of transactions) {
    if (tx.fee) {
      // Bitlayer, Ontology, Pharos
      totalGasCost += tx.fee;
    } else if (tx.gasCost) {
      // Taraxa testnet
      totalGasCost += tx.gasCost;
    } else {
      const txGasCost = tx.gasUsed * tx.gasPrice;

      totalGasCost += txGasCost;
      totalGasPrice += tx.gasPrice;
      totalGasUsed += tx.gasUsed;
    }
  }

  const avgGasPrice = totalGasPrice / BigInt(transactions.length);
  const avgGasPriceGwei = Web3.utils.fromWei(avgGasPrice.toString(), 'gwei');
  const totalCostInETH = Web3.utils.fromWei(totalGasCost.toString(), 'ether');
  const cost1h = Number(totalCostInETH) / hoursBetweenFirstLastTx;
  const gasUsed1h = Number(totalGasUsed) / hoursBetweenFirstLastTx;

  return {
    avgGasPriceGwei,
    cost1h,
    gasUsed1h,
  };
};

const logGasCosts = async (
  networkName: NetworkName,
  address: EthereumAddress,
  transactionsCount: number,
  gasCosts: {
    avgGasPriceGwei: string;
    cost1h: number;
    gasUsed1h: number;
  },
  balance: string,
  firstTransactionTime: string,
  lastTransactionTime: string,
  hoursBetweenFirstLast: number,
  prometheus: boolean,
  gauges: Gauges | null,
): Promise<void> => {
  const { currency } = networkMetadata[networkName];

  try {
    console.log(c`\n    {white ${networkName}: Processed ${transactionsCount} transactions sent by ${address} over ${hoursBetweenFirstLast} hours}
    {blue First transaction timestamp: ${firstTransactionTime}}
    {blue Last transaction timestamp: ${lastTransactionTime}}
    {yellow Average Gas Price: ${gasCosts.avgGasPriceGwei} Gwei}
    {magenta Gas for 1h: ${gasCosts.gasUsed1h}}
    {magenta Gas for 24h: ${gasCosts.gasUsed1h * 24}}
    {cyan Cost for 1h: ${gasCosts.cost1h} ${currency}}
    {cyan Cost for 24h: ${gasCosts.cost1h * 24} ${currency}}
    `);

    if (balance == null) {
      console.error(c`{red Can't calculate balance for ${networkName}}`);
    } else {
      const daysBalanceWillLast = Number(balance) / (gasCosts.cost1h * 24);
      const balanceMsg = `  Balance of ${balance} ${currency} will last approximately ${daysBalanceWillLast.toFixed(2)} days based on 24-hour costs.`;
      if (daysBalanceWillLast < 10) {
        console.log(c`{bold red ${balanceMsg}}`);
      } else if (daysBalanceWillLast >= 10 && daysBalanceWillLast <= 30) {
        console.log(c`{bold yellow ${balanceMsg}}`);
      } else {
        console.log(c`{bold green ${balanceMsg}}`);
      }

      if (gauges) {
        gauges.gasCost.set({ networkName, address }, gasCosts.gasUsed1h * 24);
        gauges.cost.set({ networkName, address }, gasCosts.cost1h * 24);
        gauges.balance.set(
          { networkName, address, currency },
          filterSmallBalance(balance),
        );
        gauges.daysLeft.set({ networkName, address }, daysBalanceWillLast);
        gauges.transactionsCount.set(
          { networkName, address },
          transactionsCount,
        );
        gauges.transactionsPeriod.set(
          { networkName, address },
          hoursBetweenFirstLast,
        );
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(
        c`{red Error logging gas costs: ${(error as Error).message}}`,
      );
    } else {
      console.error(c`{red Unexpected error: ${String(error)}}`);
    }
  }
};

const fetchTransactionsForNetwork = async (
  network: NetworkName,
  address: EthereumAddress,
  numberOfTransactions: number,
  firstTxTime: string,
  lastTxTime: string,
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
    console.log(c`{red Skipping ${network}: Missing API configuration}`);
    return { transactions: [], firstTxTime: '', lastTxTime: '' };
  }

  try {
    console.log('------------------------------------------------------------');
    console.log(c`{green ${network.toUpperCase()}}`);
    console.log(c`{blue Fetching transactions for ${network}...}`);
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
      let pageCounter = 1; //max 10000 blocks per page
      let currentBlock = latestBlock;
      do {
        const page = await axios.get(apiUrl, {
          params: {
            module: 'account',
            action: 'txlist',
            address,
            startblock: Number(currentBlock - 10000n),
            endblock: Number(currentBlock),
            apikey: apiKey,
          },
        });
        const txFromPage = page.data.result;

        rawTransactions = rawTransactions.concat(txFromPage);
        pageCounter++;
        currentBlock -= 10000n;
      } while (rawTransactions.length < numberOfTransactions);
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
        console.error(c`{red ${network} Error: ${response.data.message}}`);
        return { transactions: [], firstTxTime: '', lastTxTime: '' };
      }
      rawTransactions = response.data.result;
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
          tx.create_time?.toString() ??
          tx.block_timestamp?.toString();
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

    // Filter out all transactions before firstTxTime
    if (firstTxTime != DEFAULT_FIRST_TX_TIME) {
      const firstTxTimeAsDate = new Date(firstTxTime);
      transactions = transactions.filter((tx: Transaction) => {
        const txTime = new Date(tx.timestamp);
        return txTime >= firstTxTimeAsDate;
      });
    }

    // Filter out all transactions after lastTxTime
    if (lastTxTime != DEFAULT_LAST_TX_TIME) {
      const lastTxTimeAsDate = new Date(lastTxTime);
      transactions = transactions.filter((tx: any) => {
        const txTime = new Date(tx.timestamp);
        return txTime <= lastTxTimeAsDate;
      });
    }

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
      c`{green ${network}: Found ${transactions.length} transactions sent by the account to other addresses}`,
    );
    return {
      transactions,
      firstTxTime: firstTxTimeRet,
      lastTxTime: lastTxTimeRet,
    };
  } catch (error: any) {
    console.error(
      c`{red Error fetching transactions for ${network}: ${error.message}}`,
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
      default: 288,
    })
    .option('network', {
      alias: 'n',
      describe:
        'Calculate cost only for this network, not all deployed networks',
      type: 'string',
      default: '',
    })
    .option('firstTxTime', {
      describe:
        'Filter out transactions that are timestamped before this time. Format is ISO, e.g. 2025-01-14T03:35:14.000Z.',
      type: 'string',
      default: DEFAULT_FIRST_TX_TIME,
    })
    .option('lastTxTime', {
      describe:
        'Filter out transactions that are timestamped after this time. Format is ISO, e.g. 2025-01-14T03:35:14.000Z.',
      type: 'string',
      default: DEFAULT_LAST_TX_TIME,
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
  let gauges: Gauges | null = null;

  if (argv.prometheus) {
    startPrometheusServer(argv.host, argv.port);

    gauges = {
      gasCost: new client.Gauge({
        name: 'eth_account_gas_cost',
        help: `Daily cost in gas to run using last ${argv.numberOfTransactions} transactions`,
        labelNames: ['networkName', 'address'],
      }),
      cost: new client.Gauge({
        name: 'eth_account_cost',
        help: `Daily cost to run using last ${argv.numberOfTransactions} transactions`,
        labelNames: ['networkName', 'address'],
      }),
      balance: new client.Gauge({
        name: 'eth_account_balance',
        help: 'Ethereum account balance in native token',
        labelNames: ['networkName', 'address', 'currency'],
      }),
      daysLeft: new client.Gauge({
        name: 'eth_account_days_left',
        help: 'Days until funds run out',
        labelNames: ['networkName', 'address'],
      }),
      transactionsCount: new client.Gauge({
        name: 'transactions_count',
        help: 'Number of Transactions used to calculate cost',
        labelNames: ['networkName', 'address'],
      }),
      transactionsPeriod: new client.Gauge({
        name: 'transactions_period',
        help: 'Hours between first and last of used transactions',
        labelNames: ['networkName', 'address'],
      }),
    };
  }

  console.log(
    c`{cyan Using Ethereum address: ${address} (sequencer: ${
      address === sequencerAddress
    })}\n`,
  );

  const networks =
    argv.network == '' ? deployedNetworks : [parseNetworkName(argv.network)];

  for (const network of networks) {
    const { transactions, firstTxTime, lastTxTime } =
      await fetchTransactionsForNetwork(
        network,
        address,
        argv.numberOfTransactions,
        argv.firstTxTime,
        argv.lastTxTime,
      );
    if (transactions.length > 1) {
      const hoursBetweenFirstLastTx = getHourDifference(transactions);
      let gasCosts;
      try {
        gasCosts = calculateGasCosts(hoursBetweenFirstLastTx, transactions);
      } catch (error: any) {
        console.error(
          c`{red Error calculating gas costs for ${network}: ${error.message}}`,
        );
        continue;
      }
      const rpcUrl = getOptionalRpcUrl(network);
      let balance: string;

      if (rpcUrl === '') {
        console.log(
          c`{red No rpc url for network ${network}. Can't get balance - will use 0.}`,
        );
        balance = '0';
      } else {
        try {
          const web3 = new Web3(rpcUrl);
          const balanceWei = await web3.eth.getBalance(address);
          balance = web3.utils.fromWei(balanceWei, 'ether');
        } catch (error: any) {
          console.error(
            c`{red Error fetching balance for ${network}: ${error.message}}`,
          );
          balance = '0';
        }
      }

      if (gasCosts) {
        await logGasCosts(
          network,
          address,
          transactions.length,
          gasCosts,
          balance,
          firstTxTime,
          lastTxTime,
          hoursBetweenFirstLastTx,
          argv.prometheus,
          gauges,
        );
      }
    } else {
      console.log(
        c`{yellow ${network}: Less than 2 transactions found for the account.}`,
      );
    }
  }
};

main().catch(error => {
  console.error(c`{red Error running script:}`, error.message);
});
