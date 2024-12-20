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
  transactions: Transaction[],
): {
  avgGasCostEth: string;
  projectedCost1h: number;
  projectedCost24h: number;
} | null => {
  if (transactions.length === 0) {
    return null;
  }

  let totalGasCost = BigInt(0);
  for (const tx of transactions) {
    const gasUsed = BigInt(tx.gasUsed);
    const gasPrice = BigInt(tx.gasPrice);
    const txGasCost = gasUsed * gasPrice;
    totalGasCost += txGasCost;
  }

  const avgGasCost = totalGasCost / BigInt(transactions.length);
  const avgGasCostEth = Web3.utils.fromWei(avgGasCost.toString(), 'ether');
  const minBetweenUpdate = 5;
  const updatePerHour = 60 / minBetweenUpdate;
  const projectedCost1h = parseFloat(avgGasCostEth) * updatePerHour;
  const projectedCost24h = projectedCost1h * 24;

  return {
    avgGasCostEth,
    projectedCost1h,
    projectedCost24h,
  };
};

const logGasCosts = async (
  network: NetworkName,
  address: EthereumAddress,
  transactionsCount: number,
  gasCosts: {
    avgGasCostEth: string;
    projectedCost1h: number;
    projectedCost24h: number;
  },
  balance: string,
): Promise<void> => {
  const { currency } = networkMetadata[network];
  const logFile = 'cost-calculations.log';

  try {
    console.log(
      chalk.green(
        `${network}: Processed ${transactionsCount} transactions sent by ${address}`,
      ),
    );
    console.log(
      chalk.yellow(
        `  Average Gas Cost per Transaction: ${gasCosts.avgGasCostEth} ${currency}`,
      ),
    );
    console.log(
      chalk.magenta(
        `  Projected Cost (1h): ${gasCosts.projectedCost1h} ${currency}`,
      ),
    );
    console.log(
      chalk.cyan(
        `  Projected Cost (24h): ${gasCosts.projectedCost24h} ${currency}`,
      ),
    );

    await logToFile(logFile, `${network}:`);
    await logToFile(
      logFile,
      `  Processed ${transactionsCount} transactions sent by the account`,
    );
    await logToFile(
      logFile,
      `  Average Gas Cost per Transaction: ${gasCosts.avgGasCostEth} ${currency}`,
    );
    await logToFile(
      logFile,
      `  Projected Cost (1h): ${gasCosts.projectedCost1h} ${currency}`,
    );
    await logToFile(
      logFile,
      `  Projected Cost (24h): ${gasCosts.projectedCost24h} ${currency}`,
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
): Promise<Transaction[]> => {
  const snakeCaseNetwork = kebabToCamelCase(
    network,
  ) as keyof typeof API_ENDPOINTS;
  const apiUrl = API_ENDPOINTS[snakeCaseNetwork];
  const apikey = API_KEYS[snakeCaseNetwork];
  if (!apiUrl) {
    console.log(chalk.red(`Skipping ${network}: Missing API configuration`));
    return [];
  }

  try {
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
      return [];
    }

    const transactions: Transaction[] = response.data.result
      .filter(
        (tx: Transaction) =>
          tx.from.toLowerCase() === address.toLowerCase() &&
          tx.to.toLowerCase() !== address.toLowerCase(), // Filter out self-sent transactions
      )
      .slice(0, 576); // 2 days if we update every 5 min
    console.log(
      chalk.green(
        `${network}: Found ${transactions.length} transactions sent by the account to other addresses`,
      ),
    );
    return transactions;
  } catch (error: any) {
    console.error(
      chalk.red(`Error fetching transactions for ${network}: ${error.message}`),
    );
    return [];
  }
};

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

  for (const network of deployedNetworks) {
    const transactions = await fetchTransactionsForNetwork(network, address);
    if (transactions.length > 0) {
      const gasCosts = calculateGasCosts(transactions);
      const rpcUrl = getOptionalRpcUrl(network);
      var balance: string;

      if (rpcUrl === '') {
        console.log(
          chalk.red(
            `No rpc url for network ${network}. Cant get balance - will use 0.`,
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
