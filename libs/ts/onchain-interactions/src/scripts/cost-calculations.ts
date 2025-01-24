import axios, { AxiosResponse } from 'axios';
import Web3 from 'web3';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import { API_ENDPOINTS, API_KEYS, Transaction } from '../types';
import {
  getOptionalRpcUrl,
  networkMetadata,
  networkName,
  NetworkName,
} from '@blocksense/base-utils/evm';
import { deployedNetworks } from '../types';
import { kebabToCamelCase } from '@blocksense/base-utils/string';
import {
  EthereumAddress,
  parseEthereumAddress,
} from '@blocksense/base-utils/evm';
import { getEnvStringNotAssert } from '@blocksense/base-utils/env';
import chalkTemplate from 'chalk-template';

const calculateGasCosts = (
  secondsBetweenTransactions: number,
  transactions: Transaction[],
): {
  avgGasCostEth: string;
  avgGasPriceGwei: string;
  avgGasUsed: string;
  projectedCost1h: number;
  projectedCost24h: number;
} | null => {
  if (transactions.length === 0) {
    return null;
  }

  let totalGasCost = BigInt(0);
  let totalGasPrice = BigInt(0);
  let totalGasUsed = BigInt(0);

  for (const tx of transactions) {
    const gasUsed = BigInt(tx.gasUsed ?? tx.gas_used ?? tx.gas);
    const gasPrice = BigInt(tx.gasPrice ?? tx.gas_price);
    const txGasCost = gasUsed * gasPrice;

    totalGasCost += txGasCost;
    totalGasPrice += gasPrice;
    totalGasUsed += gasUsed;
  }

  const avgGasCost = totalGasCost / BigInt(transactions.length);
  const avgGasPrice = totalGasPrice / BigInt(transactions.length);
  const avgGasUsed = totalGasUsed / BigInt(transactions.length);

  const avgGasCostEth = Web3.utils.fromWei(avgGasCost.toString(), 'ether');
  const avgGasPriceGwei = Web3.utils.fromWei(avgGasPrice.toString(), 'gwei');

  return {
    avgGasCostEth,
    avgGasPriceGwei,
    avgGasUsed: avgGasUsed.toString(),
    projectedCost1h:
      parseFloat(avgGasCostEth) * (3600 / secondsBetweenTransactions),
    projectedCost24h:
      parseFloat(avgGasCostEth) * ((24 * 3600) / secondsBetweenTransactions),
  };
};

const logGasCosts = async (
  network: NetworkName,
  address: EthereumAddress,
  transactionsCount: number,
  gasCosts: {
    avgGasCostEth: string;
    avgGasPriceGwei: string;
    avgGasUsed: string;
    projectedCost1h: number;
    projectedCost24h: number;
  },
  balance: string,
  firstTransactionTime: string,
  lastTransactionTime: string,
  secondsBetweenTransactions: number,
): Promise<void> => {
  const { currency } = networkMetadata[network];
  const transactionsPerHour = 3600 / secondsBetweenTransactions;

  try {
    await console.log(chalkTemplate`
    {green ${network}: Processed ${transactionsCount} transactions sent by ${address}}
    {blue First transaction timestamp: ${firstTransactionTime}}
    {blue Last transaction timestamp: ${lastTransactionTime}}
    {yellow Average Transaction Cost: ${gasCosts.avgGasCostEth} ${currency}}
    {yellow Average Gas Price: ${gasCosts.avgGasPriceGwei} Gwei}
    {yellow Average Gas Used: ${gasCosts.avgGasUsed}}
    {magenta Projected Cost for 1h (${transactionsPerHour} tx): ${gasCosts.projectedCost1h} ${currency}}
    {cyan Projected Cost for 24h (${transactionsPerHour * 24} tx): ${gasCosts.projectedCost24h} ${currency}}
    `);

    if (balance == null) {
      console.error(chalk.red(`Can't calculate balance for ${network}`));
    } else {
      const daysBalanceWillLast = Number(balance) / gasCosts.projectedCost24h;
      const balanceMsg = `  Balance of ${balance} ${currency} will last approximately ${daysBalanceWillLast.toFixed(2)} days based on 24-hour projected costs.`;
      if (daysBalanceWillLast < 10) {
        console.log(chalk.red(balanceMsg));
      } else if (daysBalanceWillLast >= 10 && daysBalanceWillLast <= 30) {
        console.log(chalk.yellow(balanceMsg));
      } else {
        console.log(chalk.green(balanceMsg));
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(`Error logging gas costs: ${error.message}`));
    } else {
      console.error(chalk.red(`Unexpected error: ${String(error)}`));
    }
  }
};

const getTxTimestampAsDate = (tx: Transaction): Date =>
  new Date(tx.timestamp ?? parseInt(tx.timeStamp || '0') * 1000);

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
  const snakeCaseNetwork = kebabToCamelCase(
    network,
  ) as keyof typeof API_ENDPOINTS;
  const apiUrl = API_ENDPOINTS[snakeCaseNetwork];
  const apikey = API_KEYS[snakeCaseNetwork];
  if (!apiUrl) {
    console.log(chalk.red(`Skipping ${network}: Missing API configuration`));
    return { transactions: [], firstTxTime: '', lastTxTime: '' };
  }

  try {
    console.log('------------------------------------------------------------');
    console.log(chalk.green(network.toUpperCase()));
    console.log(chalk.blue(`Fetching transactions for ${network}...`));
    let response: AxiosResponse<any>;
    let rawTransactions;
    if (network === 'morph-holesky') {
      response = await axios.get(`${apiUrl}/addresses/${address}/transactions`);
      rawTransactions = response.data.items || [];
    } else {
      response = await axios.get(apiUrl, {
        params: {
          module: 'account',
          action: 'txlist',
          address,
          startblock: 0,
          endblock: 99999999,
          sort: 'desc',
          apikey,
        },
      });

      if (response.data.status !== '1') {
        console.error(chalk.red(`${network} Error: ${response.data.message}`));
        return { transactions: [], firstTxTime: '', lastTxTime: '' };
      }
      rawTransactions = response.data.result;
    }
    let notSelfSent: any[];
    if (network == 'cronos-testnet') {
      notSelfSent = rawTransactions.filter(
        (tx: any) =>
          tx.from.address.toLowerCase() === address.toLowerCase() &&
          tx.to.address.toLowerCase() !== address.toLowerCase(),
      ); //cronos has a different call
    } else if (network == 'morph-holesky') {
      notSelfSent = rawTransactions.filter(
        (tx: any) =>
          tx.from.hash.toLowerCase() === address.toLowerCase() &&
          tx.to.hash.toLowerCase() !== address.toLowerCase(),
      ); //morph has a different call
    } else {
      notSelfSent = rawTransactions.filter(
        (tx: any) =>
          tx.from.toLowerCase() === address.toLowerCase() &&
          tx.to.toLowerCase() !== address.toLowerCase(), // Filter out self-sent transactions
      );
    }

    let limitedInTime = notSelfSent;

    if (firstTxTime != DEFAULT_FIRST_TX_TIME) {
      const firstTxTimeAsDate = new Date(firstTxTime);
      limitedInTime = limitedInTime.filter((tx: Transaction) => {
        const txTime = getTxTimestampAsDate(tx);
        return txTime >= firstTxTimeAsDate;
      });
    }

    if (lastTxTime != DEFAULT_LAST_TX_TIME) {
      const lastTxTimeAsDate = new Date(lastTxTime);
      limitedInTime = limitedInTime.filter((tx: any) => {
        const txTime = getTxTimestampAsDate(tx);
        return txTime <= lastTxTimeAsDate;
      });
    }

    const transactions: Transaction[] = limitedInTime.slice(
      0,
      numberOfTransactions,
    );

    let firstTxTimeRet = '';
    let lastTxTimeRet = '';
    if (transactions.length > 0) {
      firstTxTimeRet = getTxTimestampAsDate(
        transactions[transactions.length - 1],
      ).toISOString();
      lastTxTimeRet = getTxTimestampAsDate(transactions[0]).toISOString();
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
      'Usage: $0 --numberOfTransactions <number> --secondsBetweenTransactions <number> [--address <ethereum address>]',
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
    .option('secondsBetweenTransactions', {
      alias: 'time',
      describe: 'Time between Transactions in seconds',
      type: 'number',
      default: 300, //5min
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
  console.log(
    chalk.cyan(
      `Using ${argv.secondsBetweenTransactions} seconds between transactions`,
    ),
  );

  const networks = argv.network == '' ? deployedNetworks : [argv.network];

  for (const network of networks) {
    const { transactions, firstTxTime, lastTxTime } =
      await fetchTransactionsForNetwork(
        network,
        address,
        argv.numberOfTransactions,
        argv.firstTxTime,
        argv.lastTxTime,
      );
    if (transactions.length > 0) {
      const gasCosts = calculateGasCosts(
        argv.secondsBetweenTransactions,
        transactions,
      );
      const rpcUrl = getOptionalRpcUrl(network);
      var balance: string;

      if (rpcUrl === '') {
        console.log(
          chalk.red(
            `No rpc url for network ${network}. Can't get balance - will use 0.`,
          ),
        );
        balance = '0';
      } else {
        const web3 = new Web3(rpcUrl);
        const balanceWei = await web3.eth.getBalance(address);
        balance = web3.utils.fromWei(balanceWei, 'ether');
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
          argv.secondsBetweenTransactions,
        );
      }
    } else {
      console.log(
        chalk.yellow(`${network}: No transactions found for the account.`),
      );
    }
  }
};

main().catch(error => {
  console.error(chalk.red('Error running script:'), error.message);
});
