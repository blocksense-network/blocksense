import axios, { AxiosResponse } from 'axios';
import Web3 from 'web3';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import { API_ENDPOINTS, API_KEYS, Transaction } from '../types';
import { networkMetadata, NetworkName } from '@blocksense/base-utils/evm';
import { deployedNetworks } from '../types';
import { kebabToCamelCase } from '@blocksense/base-utils/string';
import { logToFile } from '@blocksense/base-utils/logging';
import {
  EthereumAddress,
  parseEthereumAddress,
} from '@blocksense/base-utils/evm';

import * as fs from 'fs/promises';

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
): Promise<void> => {
  const metadata = networkMetadata[network];
  const currency = metadata.currency || 'ETH';
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
        (tx: Transaction) => tx.from.toLowerCase() === address.toLowerCase(),
      )
      .slice(0, 576); //2 days if we update every 5 min
    console.log(
      chalk.green(
        `${network}: Found ${transactions.length} transactions sent by the account`,
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
  const currentSequencerAddress = '0xd756119012CcabBC59910dE0ecEbE406B5b952bE';
  const argv = await yargs(hideBin(process.argv))
    .usage('Usage: $0 [--address <ethereum address>]')
    .option('address', {
      alias: 'a',
      describe: 'Ethereum address to fetch transactions for',
      type: 'string',
      default: currentSequencerAddress,
    })
    .help()
    .alias('help', 'h')
    .parse();

  const address = parseEthereumAddress(argv.address);

  console.log(
    chalk.cyan(
      `Using Ethereum address: ${address} (sequencer: ${
        address === currentSequencerAddress
      })\n`,
    ),
  );

  for (const network of deployedNetworks) {
    const transactions = await fetchTransactionsForNetwork(network, address);
    if (transactions.length > 0) {
      const gasCosts = calculateGasCosts(transactions);
      if (gasCosts) {
        await logGasCosts(network, address, transactions.length, gasCosts);
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
