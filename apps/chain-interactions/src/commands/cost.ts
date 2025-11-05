import { Effect, Option, Schema as S } from 'effect';
import { Command, Options } from '@effect/cli';
import {
  withAlias,
  withDefault,
  withDescription,
  withSchema,
} from '@effect/cli/Options';
import type { AxiosResponse } from 'axios';
import axios from 'axios';
import client from 'prom-client';
import Web3 from 'web3';

import type { EthereumAddress, NetworkName } from '@blocksense/base-utils/evm';
import {
  getOptionalApiKey,
  getOptionalRpcUrl,
  isTestnet,
  networkMetadata,
  parseEthereumAddress,
} from '@blocksense/base-utils/evm';
import { color as c } from '@blocksense/base-utils/tty';
import { listEvmNetworks } from '@blocksense/config-types/read-write-config';

import type { Transaction } from './types';
import {
  filterSmallBalance,
  getBalance,
  getDefaultSequencerAddress,
  getNetworks,
  getWeb3,
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
      withAlias('num'),
    ),
    network: Options.optional(
      Options.choice('network', await listEvmNetworks()).pipe(withAlias('n')),
    ),
    rpcUrlInput: Options.optional(
      Options.text('rpc').pipe(withSchema(S.URL), withAlias('r')),
    ),
    firstTxTimeInput: Options.text('first-tx-time').pipe(
      withDefault(DEFAULT_FIRST_TX_TIME),
    ),
    lastTxTimeInput: Options.text('last-tx-time').pipe(
      withDefault(DEFAULT_LAST_TX_TIME),
    ),
    prometheus: Options.boolean('prometheus').pipe(withAlias('p')),
    host: Options.text('host').pipe(withDefault('localhost')),
    port: Options.integer('port').pipe(withDefault(9090)),
    mainnet: Options.boolean('mainnet').pipe(
      withAlias('m'),
      withDescription('Show cost for deployedMainnets'),
    ),
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
    rpcUrlInput,
  }) =>
    Effect.gen(function* () {
      const parsedNetwork = Option.getOrNull(network);

      const shouldUseMainnetSequencer =
        mainnet || (parsedNetwork !== null && !isTestnet(parsedNetwork));

      const sequencerAddress = yield* getDefaultSequencerAddress(
        shouldUseMainnetSequencer,
      );

      const address = parseEthereumAddress(
        Option.getOrElse(addressInput, () => sequencerAddress),
      );

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
      const networks = yield* getNetworks(network, rpcUrlInput, mainnet);

      for (const networkName of networks as Array<'unknown' | NetworkName>) {
        if (networkName === 'unknown') {
          console.log(c`{red Unknown network. Can't fetch transactions.}`);
          return;
        }
        const fetchResult = yield* fetchTransactionsForNetwork(
          networkName as NetworkName,
          address,
          numberOfTransactions,
          firstTxTimeInput,
          lastTxTimeInput,
        );
        if (fetchResult.transactions.length < 2) {
          continue;
        }

        const {
          firstTxTime: firstTxTimeResult,
          lastTxTime: lastTxTimeResult,
          transactions,
        } = fetchResult;

        const gasCosts = yield* calculateGasCosts(transactions);

        if (!gasCosts) {
          continue;
        }

        const rpcUrl = getOptionalRpcUrl(networkName as NetworkName);

        const web3 = yield* getWeb3(rpcUrl);
        if (!web3) {
          continue;
        }
        const balance = yield* getBalance(address, web3);

        yield* logGasCosts(
          networkName,
          address,
          transactions.length,
          gasCosts,
          balance,
          firstTxTimeResult,
          lastTxTimeResult,
          gauges,
        );
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

function getHourDifference(
  transactions: Transaction[],
): Effect.Effect<number, never, never> {
  if (transactions.length < 2) {
    console.error('Less then 2 transactions in getHourDifference');
    return Effect.succeed(0);
  }
  const firstTransactionTime = new Date(transactions[0].timestamp);
  const lastTransactionTime = new Date(
    transactions[transactions.length - 1].timestamp,
  );

  const diffMs = firstTransactionTime.getTime() - lastTransactionTime.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  return Effect.succeed(diffHours);
}

const calculateGasCosts = (
  transactions: Transaction[],
): Effect.Effect<
  {
    avgGasPriceGwei: string;
    cost1h: number;
    gasUsed1h: number;
    hoursBetweenFirstLastTx: number;
  } | null,
  never,
  never
> =>
  Effect.gen(function* () {
    if (transactions.length < 2) {
      console.error('Less then 2 transactions in calculateGasCosts');
      return null;
    }

    const hoursBetweenFirstLastTx = yield* getHourDifference(transactions);

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
      hoursBetweenFirstLastTx,
    };
  });

const logGasCosts = (
  networkName: NetworkName,
  address: EthereumAddress,
  transactionsCount: number,
  gasCosts: {
    avgGasPriceGwei: string;
    cost1h: number;
    gasUsed1h: number;
    hoursBetweenFirstLastTx: number;
  },
  balance: string,
  firstTransactionTime: string,
  lastTransactionTime: string,
  gauges: Gauges | null,
): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    const { currency } = networkMetadata[networkName];

    console.log(c`\n    {white ${networkName}: Processed ${transactionsCount} transactions sent by ${address} over ${gasCosts.hoursBetweenFirstLastTx} hours}
    {blue First transaction timestamp: ${firstTransactionTime}}
    {blue Last transaction timestamp: ${lastTransactionTime}}
    {yellow Average Gas Price: ${gasCosts.avgGasPriceGwei} Gwei}
    {magenta Gas for 1h: ${gasCosts.gasUsed1h}}
    {magenta Gas for 24h: ${gasCosts.gasUsed1h * 24}}
    {cyan Cost for 1h: ${gasCosts.cost1h} ${currency}}
    {cyan Cost for 24h: ${gasCosts.cost1h * 24} ${currency}}
    `);

    if (balance === null || balance === undefined) {
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
          yield* filterSmallBalance(balance),
        );
        gauges.daysLeft.set({ networkName, address }, daysBalanceWillLast);
        gauges.transactionsCount.set(
          { networkName, address },
          transactionsCount,
        );
        gauges.transactionsPeriod.set(
          { networkName, address },
          gasCosts.hoursBetweenFirstLastTx,
        );
      }
    }
  });

const fetchTransactionsForNetwork = (
  network: NetworkName,
  address: EthereumAddress,
  numberOfTransactions: number,
  firstTxTime: string,
  lastTxTime: string,
): Effect.Effect<FetchTransactionsResult, never, never> => {
  const emptyResult: FetchTransactionsResult = {
    transactions: [],
    firstTxTime: '',
    lastTxTime: '',
  };

  return Effect.gen(function* () {
    const apiUrl = networksUseSecondExplorer.includes(network)
      ? networkMetadata[network].explorers[1]?.apiUrl
      : networkMetadata[network].explorers[0]?.apiUrl;

    if (!apiUrl) {
      console.log(c`{red Skipping ${network}: Missing API configuration}`);
      return emptyResult;
    }

    console.log('------------------------------------------------------------');
    console.log(c`{green ${network.toUpperCase()}}`);
    console.log(c`{blue Fetching transactions for ${network}...}`);

    const web3 = yield* getWeb3(getOptionalRpcUrl(network));
    if (!web3) {
      console.error(
        c`{red Failed to initialize Web3 for network ${network}. Returning empty result.}`,
      );
      return emptyResult;
    }

    const latestBlock = yield* Effect.tryPromise(() =>
      web3.eth.getBlockNumber(),
    );

    const axiosGet = (url: string, config?: any) =>
      Effect.tryPromise(() => axios.get(url, config));

    const apiKey = getOptionalApiKey(network);
    let response: AxiosResponse<any>;
    let rawTransactions: any[] = [];

    if (networksV2Api.includes(network)) {
      response = yield* axiosGet(
        `${apiUrl}/v2/addresses/${address}/transactions`,
      );
      rawTransactions = response.data.items || [];
    } else if (network === 'telos-testnet') {
      response = yield* axiosGet(`${apiUrl}/address/${address}/transactions`);
      rawTransactions = response.data.results || [];
    } else if (
      network === 'pharos-atlantic-testnet' ||
      network === 'cyber-testnet'
    ) {
      response = yield* axiosGet(`${apiUrl}/address/${address}/transactions`);
      rawTransactions = response.data.data || [];
    } else if (network === 'taraxa-testnet') {
      response = yield* axiosGet(
        `${apiUrl}/address/${address}/transactions?limit=100`,
      );
      rawTransactions = response.data.data || [];
    } else if (network === 'ontology-testnet') {
      response = yield* axiosGet(
        `${apiUrl}/addresses/${address}/txs?page_size=20&page_number=1`,
      );
      rawTransactions = response.data.result.records || [];
    } else if (network === 'cronos-testnet') {
      const cronosLoopState = {
        rawTransactions,
        currentBlock: latestBlock,
      };
      yield* Effect.loop(cronosLoopState, {
        while: state => state.rawTransactions.length < numberOfTransactions,
        step: state => state,
        discard: true,
        body: state =>
          Effect.gen(function* () {
            const page = yield* axiosGet(apiUrl, {
              params: {
                module: 'account',
                action: 'txlist',
                address,
                startblock: Number(state.currentBlock - 10000n),
                endblock: Number(state.currentBlock),
                apikey: apiKey,
              },
            });
            state.rawTransactions = state.rawTransactions.concat(
              page.data.result,
            );
            state.currentBlock -= 10000n;
          }),
      });
      rawTransactions = cronosLoopState.rawTransactions;
    } else if (
      network === 'bitlayer-testnet' ||
      network === 'bitlayer-mainnet'
    ) {
      const chainId =
        network === 'bitlayer-testnet' ? 'BITLAYERTEST' : 'BITLAYER';
      response = yield* axiosGet(
        `${apiUrl}/txs/list?ps=1000&a=${address}&chainId=${chainId}`,
      );
      rawTransactions = response.data.data.records || [];
    } else if (network === 'core-testnet') {
      response = yield* axiosGet(
        `${apiUrl}/accounts/list_of_txs_by_address/${address}?apikey=${apiKey}`,
      );

      if (response.data.status !== '1') {
        console.error(c`{red ${network} Error: ${response.data.message}}`);
        return emptyResult;
      }
      rawTransactions = response.data.result;
    } else {
      response = yield* axiosGet(apiUrl, {
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
        return emptyResult;
      }
      rawTransactions = response.data.result;
    }

    if (network === 'polygon-amoy') {
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

    transactions = transactions.filter(
      tx =>
        tx.from.toLowerCase() === address.toLowerCase() &&
        tx.to.toLowerCase() !== address.toLowerCase(),
    );

    if (firstTxTime !== DEFAULT_FIRST_TX_TIME) {
      const firstTxTimeAsDate = new Date(firstTxTime);
      transactions = transactions.filter((tx: Transaction) => {
        const txTime = new Date(tx.timestamp);
        return txTime >= firstTxTimeAsDate;
      });
    }

    if (lastTxTime !== DEFAULT_LAST_TX_TIME) {
      const lastTxTimeAsDate = new Date(lastTxTime);
      transactions = transactions.filter(tx => {
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
  }).pipe(
    Effect.catchAll(error =>
      Effect.sync(() => {
        console.error(
          c`{red Error fetching transactions for ${network}: ${
            error instanceof Error ? error.message : String(error)
          }}`,
        );
        return emptyResult;
      }),
    ),
  );
};
