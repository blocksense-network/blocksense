import { Effect, Option } from 'effect';
import { Command, Options } from '@effect/cli';
import { withAlias, withDefault } from '@effect/cli/Options';
import type { AxiosResponse } from 'axios';
import axios from 'axios';
import client from 'prom-client';
import Web3 from 'web3';

import { throwError } from '@blocksense/base-utils/errors';
import type { EthereumAddress, NetworkName } from '@blocksense/base-utils/evm';
import {
  getOptionalApiKey,
  getOptionalRpcUrl,
  isTestnet,
  networkMetadata,
  parseEthereumAddress,
  parseNetworkName,
} from '@blocksense/base-utils/evm';
import { color as c } from '@blocksense/base-utils/tty';
import { listEvmNetworks } from '@blocksense/config-types/read-write-config';

import type { Transaction } from './types';
import { deployedMainnets, deployedTestnets } from './types';
import {
  filterSmallBalance,
  getDefaultSequencerAddress,
  startPrometheusServer,
} from './utils';

const DEFAULT_FIRST_TX_TIME = '';
const DEFAULT_LAST_TX_TIME = '';

export const cost = Command.make(
  'cost',
  {
    addressInput: Options.optional(
      Options.text('address').pipe(withAlias('a')),
    ),
    numberOfTransactions: Options.integer('number-of-transactions').pipe(
      withDefault(1000),
      withAlias('n'),
    ),
    network: Options.optional(
      Options.choice('network', await listEvmNetworks()).pipe(withAlias('n')),
    ),
    firstTxTimeInput: Options.text('first-tx-time').pipe(
      withDefault(DEFAULT_FIRST_TX_TIME),
    ),
    lastTxTimeInput: Options.text('last-tx-time').pipe(
      withDefault(DEFAULT_LAST_TX_TIME),
    ),
    prometheus: Options.boolean('prometheus').pipe(withAlias('p')),
    host: Options.text('host').pipe(withDefault('localhost'), withAlias('h')),
    port: Options.integer('port').pipe(withDefault(9090)),
    mainnet: Options.boolean('mainnet').pipe(withAlias('m')),
  },
  ({
    addressInput,
    firstTxTimeInput,
    host,
    lastTxTimeInput,
    mainnet,
    network,
    numberOfTransactions,
    port,
    prometheus,
  }) =>
    Effect.gen(function* () {
      const parsedNetwork = Option.isSome(network)
        ? parseNetworkName(network.value)
        : null;
      const shouldUseMainnetSequencer =
        mainnet || (parsedNetwork !== null && !isTestnet(parsedNetwork));

      const sequencerAddress = getDefaultSequencerAddress(
        shouldUseMainnetSequencer,
      );

      let address: EthereumAddress;
      if (Option.isSome(addressInput)) {
        address = parseEthereumAddress(addressInput.value);
      } else {
        address = sequencerAddress;
      }

      let gauges: Gauges | null = null;

      if (prometheus) {
        startPrometheusServer(host, port);

        gauges = {
          gasCost: new client.Gauge({
            name: 'eth_account_gas_cost',
            help: `Daily cost in gas to run using last ${numberOfTransactions} transactions`,
            labelNames: ['networkName', 'address'],
          }),
          cost: new client.Gauge({
            name: 'eth_account_cost',
            help: `Daily cost to run using last ${numberOfTransactions} transactions`,
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
        parsedNetwork !== null
          ? [parsedNetwork]
          : mainnet
            ? deployedMainnets
            : deployedTestnets;

      for (const networkName of networks) {
        const fetchResult = yield* Effect.tryPromise({
          try: (): Promise<FetchTransactionsResult> =>
            fetchTransactionsForNetwork(
              networkName,
              address,
              numberOfTransactions,
              firstTxTimeInput,
              lastTxTimeInput,
            ),
          catch: error => {
            const err =
              error instanceof Error ? error : new Error(String(error));
            console.error(
              c`{red Failed to fetch transactions for network ${networkName}}`,
              err.message,
            );
            return err;
          },
        }).pipe(
          Effect.catchAll(() =>
            Effect.succeed<FetchTransactionsResult | null>(null),
          ),
        );
        if (!fetchResult) {
          continue;
        }

        const {
          firstTxTime: firstTxTimeResult,
          lastTxTime: lastTxTimeResult,
          transactions,
        } = fetchResult;

        if (transactions.length > 1) {
          const hoursBetweenFirstLastTx = getHourDifference(transactions);

          const gasCosts = yield* Effect.try({
            try: () => calculateGasCosts(hoursBetweenFirstLastTx, transactions),
            catch: e =>
              console.error(
                c`{red Failed to fetch gas costs for network ${networkName}}`,
                (e as Error).message,
              ),
          }).pipe(Effect.catchAll(() => Effect.succeed(null)));

          if (!gasCosts) {
            continue;
          }

          const rpcUrl = getOptionalRpcUrl(networkName);
          let balance: string;

          if (rpcUrl === '') {
            console.log(
              c`{red No rpc url for network ${networkName}. Can't get balance - will use 0.}`,
            );
            balance = '0';
          } else {
            const web3 = new Web3(rpcUrl);

            let balanceWei = yield* Effect.tryPromise({
              try: () => web3.eth.getBalance(address),
              catch: e =>
                console.error(
                  c`{red Failed to fetch balance from (RPC: ${rpcUrl})}`,
                  (e as Error).message,
                ),
            }).pipe(Effect.catchAll(() => Effect.succeed(null)));
            if (!balanceWei) {
              balanceWei = 0n;
            }
            balance = web3.utils.fromWei(balanceWei, 'ether');
          }

          logGasCosts(
            networkName,
            address,
            transactions.length,
            gasCosts,
            balance,
            firstTxTimeResult,
            lastTxTimeResult,
            hoursBetweenFirstLastTx,
            gauges,
          );
        } else {
          console.log(
            c`{yellow ${networkName}: Less than 2 transactions found for the account.}`,
          );
        }
      }
    }),
);

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
  'flare-coston',
  'surge-testnet',
  'aurora-testnet',
  'zephyr-testnet',
  'pyrope-testnet',
  'lumia-beam-testnet',
];

type Gauges = {
  gasCost: client.Gauge;
  cost: client.Gauge;
  balance: client.Gauge;
  daysLeft: client.Gauge;
  transactionsCount: client.Gauge;
  transactionsPeriod: client.Gauge;
};

type FetchTransactionsResult = {
  transactions: Transaction[];
  firstTxTime: string;
  lastTxTime: string;
};

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
        console.log(c`{red ${balanceMsg}}`);
      } else if (daysBalanceWillLast >= 10 && daysBalanceWillLast <= 30) {
        console.log(c`{yellow ${balanceMsg}}`);
      } else {
        console.log(c`{green ${balanceMsg}}`);
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
      response = await axios.get(
        `${apiUrl}/v2/addresses/${address}/transactions`,
      );
      rawTransactions = response.data.items || [];
    } else if (network === 'telos-testnet') {
      response = await axios.get(`${apiUrl}/address/${address}/transactions`);
      rawTransactions = response.data.results || [];
    } else if (
      network === 'pharos-atlantic-testnet' ||
      network === 'cyber-testnet'
    ) {
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
      let _pageCounter = 1; //max 10000 blocks per page
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
        _pageCounter++;
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
    } else if (network === 'core-testnet') {
      response = await axios.get(
        `${apiUrl}/accounts/list_of_txs_by_address/${address}?apikey=${apiKey}`,
      );

      if (response.data.status !== '1') {
        console.error(c`{red ${network} Error: ${response.data.message}}`);
        return { transactions: [], firstTxTime: '', lastTxTime: '' };
      }
      rawTransactions = response.data.result;
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

        let fee =
          tx.txFee ?? tx.fee ?? tx.transaction_fee ?? tx.total_transaction_fee;
        fee =
          typeof fee === 'string'
            ? BigInt((Number(fee) * 1000000000000000000).toFixed(0))
            : BigInt(0);

        if (network === 'cyber-testnet') {
          tx.gas_price = 0;
        }
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
