import axios, { AxiosResponse } from 'axios';
import Web3 from 'web3';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import { API_ENDPOINTS, API_KEYS, Transaction } from '../types';
import {
  getOptionalRpcUrl,
  networkMetadata,
  NetworkName,
} from '@blocksense/base-utils/evm';
import { deployedNetworks } from '../types';
import { kebabToCamelCase } from '@blocksense/base-utils/string';
import { logToFile } from '@blocksense/base-utils/logging';
import {
  EthereumAddress,
  parseEthereumAddress,
} from '@blocksense/base-utils/evm';
import { getEnvStringNotAssert } from '@blocksense/base-utils/env';

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
    const gasUsed = BigInt(tx.gasUsed);
    const gasPrice = BigInt(tx.gasPrice);
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
  const logFile = 'cost-calculations.log';
  const transactionsPerHour = 3600 / secondsBetweenTransactions;

  try {
    console.log(
      chalk.green(
        `${network}: Processed ${transactionsCount} transactions sent by ${address}`,
      ),
    );
    console.log(
      chalk.blue(`  First transaction timestamp: ${firstTransactionTime}`),
    );
    console.log(
      chalk.blue(`  Last transaction timestamp: ${lastTransactionTime}`),
    );
    console.log(
      chalk.yellow(
        `  Average Transaction Cost: ${gasCosts.avgGasCostEth} ${currency}`,
      ),
    );
    console.log(
      chalk.yellow(`  Average Gas Price: ${gasCosts.avgGasPriceGwei} Gwei`),
    );
    console.log(chalk.yellow(`  Average Gas Used: ${gasCosts.avgGasUsed}`));
    console.log(
      chalk.magenta(
        `  Projected Cost for 1h (${transactionsPerHour} tx): ${gasCosts.projectedCost1h} ${currency}`,
      ),
    );
    console.log(
      chalk.cyan(
        `  Projected Cost for 24h (${transactionsPerHour * 24} tx): ${gasCosts.projectedCost24h} ${currency}`,
      ),
    );

    await logToFile(logFile, `${network}:`);
    await logToFile(
      logFile,
      `  Processed ${transactionsCount} transactions sent by the account`,
    );
    await logToFile(
      logFile,
      `  First transaction timestamp: ${firstTransactionTime}`,
    );
    await logToFile(
      logFile,
      `  Last transaction timestamp: ${lastTransactionTime}`,
    );
    await logToFile(
      logFile,
      `  Average Transaction Cost: ${gasCosts.avgGasCostEth} ${currency}`,
    );
    await logToFile(
      logFile,
      `  Average Gas Price: ${gasCosts.avgGasPriceGwei} Gwei`,
    );
    await logToFile(logFile, `  Average Gas Used: ${gasCosts.avgGasUsed}`);
    await logToFile(
      logFile,
      `  Projected Cost for 1h (${transactionsPerHour} tx): ${gasCosts.projectedCost1h} ${currency}`,
    );
    await logToFile(
      logFile,
      `  Projected Cost 24h (${transactionsPerHour * 24} tx): ${gasCosts.projectedCost24h} ${currency}`,
    );

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

      await logToFile(
        logFile,
        `  Balance of ${balance} ${currency} will last approximately ${daysBalanceWillLast.toFixed(2)} days based on 24-hour projected costs.`,
      );
    }

    await logToFile(logFile, `\n`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(`Error logging gas costs: ${error.message}`));
    } else {
      console.error(chalk.red(`Unexpected error: ${String(error)}`));
    }
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
    const response: AxiosResponse<any> = await axios.get(apiUrl, {
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

    const rawTransactions = response.data.result;
    const transactions: Transaction[] = rawTransactions
      .filter(
        (tx: any) =>
          tx.from.toLowerCase() === address.toLowerCase() &&
          tx.to.toLowerCase() !== address.toLowerCase(), // Filter out self-sent transactions
      )
      .slice(0, numberOfTransactions)
      .map((tx: any) => ({
        gasUsed: tx.gasUsed,
        gasPrice: tx.gasPrice,
        from: tx.from,
        to: tx.to,
        timeStamp: tx.timeStamp,
      }));

    let firstTxTime = '';
    let lastTxTime = '';
    if (transactions.length > 0) {
      firstTxTime = new Date(
        parseInt(transactions[transactions.length - 1].timeStamp || '0') * 1000,
      ).toISOString();
      lastTxTime = new Date(
        parseInt(transactions[0].timeStamp || '0') * 1000,
      ).toISOString();
    }

    console.log(
      chalk.green(
        `${network}: Found ${transactions.length} transactions sent by the account to other addresses`,
      ),
    );
    return { transactions, firstTxTime, lastTxTime };
  } catch (error: any) {
    console.error(
      chalk.red(`Error fetching transactions for ${network}: ${error.message}`),
    );
    return { transactions: [], firstTxTime: '', lastTxTime: '' };
  }
};

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
