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
import {
  EthereumAddress,
  parseEthereumAddress,
} from '@blocksense/base-utils/evm';
import { getEnvStringNotAssert } from '@blocksense/base-utils/env';
import chalkTemplate from 'chalk-template';
import { throwError } from 'libs/ts/base-utils/src/errors';
import fs from 'fs';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

type ChainLinkFeed = {
  assetName: string;
  pairName: string;
  address: EthereumAddress;
  aggregator: EthereumAddress;
  v2: boolean;
};

const v1Topic =
  '0xf6a97944f31ea060dfde0566e4167c1a1082551e64b60ecb14d599a9d023d451';
const v2Topic =
  '0xc797025feeeaf2cd924c99e9205acb8ec04d5cad21c41ce637a38fb6dee6016a';

const ethereumData =
  'https://reference-data-directory.vercel.app/feeds-mainnet.json';

const ethereumSepoliaData =
  'https://reference-data-directory.vercel.app/feeds-ethereum-testnet-sepolia.json';

const bscData =
  'https://reference-data-directory.vercel.app/feeds-bsc-mainnet.json';

const bscTestnetData =
  'https://reference-data-directory.vercel.app/feeds-bsc-testnet.json';

const polygonData =
  'https://reference-data-directory.vercel.app/feeds-matic-mainnet.json';

const polygonAmoyData =
  'https://reference-data-directory.vercel.app/feeds-polygon-testnet-amoy.json';

const gnosisData =
  'https://reference-data-directory.vercel.app/feeds-xdai-mainnet.json';

const avalancheData =
  'https://reference-data-directory.vercel.app/feeds-avalanche-mainnet.json';

const avalancheFujiData =
  'https://reference-data-directory.vercel.app/feeds-avalanche-fuji-testnet.json';

const fantomData =
  'https://reference-data-directory.vercel.app/feeds-fantom-mainnet.json';

const fantomTestnetData =
  'https://reference-data-directory.vercel.app/feeds-fantom-testnet.json';

const arbitrumData =
  'https://reference-data-directory.vercel.app/feeds-ethereum-mainnet-arbitrum-1.json';

const arbitrumSepoliaData =
  'https://reference-data-directory.vercel.app/feeds-ethereum-testnet-sepolia-arbitrum-1.json';

const optimismData =
  'https://reference-data-directory.vercel.app/feeds-ethereum-mainnet-optimism-1.json';

const optimismSepoliaData =
  'https://reference-data-directory.vercel.app/feeds-ethereum-testnet-sepolia-optimism-1.json';

const moonriverData =
  'https://reference-data-directory.vercel.app/feeds-kusama-mainnet-moonriver.json';

const moonbeamData =
  'https://reference-data-directory.vercel.app/feeds-polkadot-mainnet-moonbeam.json';

const metisData =
  'https://reference-data-directory.vercel.app/feeds-ethereum-mainnet-andromeda-1.json';

const baseData =
  'https://reference-data-directory.vercel.app/feeds-ethereum-mainnet-base-1.json';

const baseSepoliaData =
  'https://reference-data-directory.vercel.app/feeds-ethereum-testnet-sepolia-base-1.json';

const celoData =
  'https://reference-data-directory.vercel.app/feeds-celo-mainnet.json';

const celoAlfajoresData =
  'https://reference-data-directory.vercel.app/feeds-celo-testnet-alfajores.json';

const scrollData =
  'https://reference-data-directory.vercel.app/feeds-ethereum-mainnet-scroll-1.json';

const scrollSepoliaData =
  'https://reference-data-directory.vercel.app/feeds-ethereum-testnet-sepolia-scroll-1.json';

const lineaData =
  'https://reference-data-directory.vercel.app/feeds-ethereum-mainnet-linea-1.json';

const zksyncData =
  'https://reference-data-directory.vercel.app/feeds-ethereum-mainnet-zksync-1.json';

const zksyncSepoliaData =
  'https://reference-data-directory.vercel.app/feeds-ethereum-testnet-sepolia-zksync-1.json';

const polygonZKEVMData =
  'https://reference-data-directory.vercel.app/feeds-ethereum-mainnet-polygon-zkevm-1.json';

const polygonZKEVMSepoliaData =
  'https://reference-data-directory.vercel.app/feeds-ethereum-testnet-sepolia-polygon-zkevm-1.json';

const soneiumData =
  'https://reference-data-directory.vercel.app/feeds-soneium-mainnet.json';

const soneiumMinatoData =
  'https://reference-data-directory.vercel.app/feeds-ethereum-testnet-sepolia-soneium-1.json';

// const starknetData =
//   'https://reference-data-directory.vercel.app/feeds-ethereum-mainnet-starknet-1.json';

// const starknetSepoliaData =
//   'https://reference-data-directory.vercel.app/feeds-ethereum-testnet-sepolia-starknet-1.json';

// const solanaData =
//   'https://reference-data-directory.vercel.app/feeds-solana-mainnet.json';

// const solanaDevnetData =
//   'https://reference-data-directory.vercel.app/feeds-solana-devnet.json';

const hederaData =
  'https://reference-data-directory.vercel.app/feeds-hedera-mainnet.json';

const hederaTestnetData =
  'https://reference-data-directory.vercel.app/feeds-hedera-testnet.json';

const aptosData = 'https://docs.chain.link/files/json/feeds-aptos-mainnet.json';

// const aptosTestnetData =
//   'https://docs.chain.link/files/json/feeds-aptos-testnet.json';

const sonicData =
  'https://reference-data-directory.vercel.app/feeds-sonic-mainnet.json';

const mantleData =
  'https://reference-data-directory.vercel.app/feeds-ethereum-mainnet-mantle-1.json';

const xLayerData =
  'https://reference-data-directory.vercel.app/feeds-ethereum-mainnet-xlayer-1.json';

const xLayerTestnetData =
  'https://reference-data-directory.vercel.app/feeds-ethereum-testnet-sepolia-xlayer-1.json';

const roninData =
  'https://reference-data-directory.vercel.app/feeds-ronin-mainnet.json';

const roninSaigonData =
  'https://reference-data-directory.vercel.app/feeds-ronin-saigon-testnet.json';

const botanixTestnetData =
  'https://reference-data-directory.vercel.app/feeds-bitcoin-testnet-botanix.json';

const unichainSepoliaData =
  'https://reference-data-directory.vercel.app/feeds-ethereum-testnet-sepolia-unichain-1.json';

async function fetchJson(fetchLink: string): Promise<any> {
  try {
    const response = await axios.get(fetchLink);
    const jsonData = response.data;

    return jsonData;
  } catch (error) {
    console.error('Error fetching JSON:', error);
    throw error;
  }
}
const main = async (): Promise<void> => {
  const jsonData = await fetchJson(aptosData);
  const api = API_ENDPOINTS['aptos'];
  const apikey = getEnvStringNotAssert('NODEREAL_API_KEY');
  // starknetSepoliaData
  let sumOfAvgTxGas = 0;
  let feedsCounter = 0;
  for (const feed of jsonData) {
    if (feed.contractVersion != 100) {
      //   continue;
      // }
      let topic = feed.contractVersion == 4 ? v1Topic : v2Topic;

      await delay(300);
      const aggregatorAddress = feed.contractAddress;
      console.log('_________');
      const response = await axios.get(api, {
        params: {
          module: 'logs',
          action: 'getLogs',
          address: aggregatorAddress,
          fromBlock: 0,
          toBlock: 'latest',
          topic0: topic,
          sort: 'desc',
          apikey,
        },
      });
      // console.log();
      console.log(response.data);
      const rawTransactions = response.data.result;
      if (rawTransactions.length < 2) {
        // need 2 tx to have a min and a max
        continue;
      }
      let totalGasCost = BigInt(0);
      let totalGasPrice = BigInt(0);
      let totalGasUsed = BigInt(0);
      let maxGasTx = BigInt(0);
      let minGasTx = BigInt(0);
      let maxGasTxIndex = 0;
      let minGasTxIndex = 0;

      // console.log(typeof rawTransactions);
      if (typeof rawTransactions === 'string') {
        console.log(rawTransactions);
      }

      for (const [index, tx] of rawTransactions.entries()) {
        const gasUsed = BigInt(tx.gasUsed ?? tx.gas_used ?? tx.gas);
        const gasPrice = BigInt(tx.gasPrice ?? tx.gas_price);
        const txGasCost = gasUsed * gasPrice;

        if (index === 0 || gasUsed > maxGasTx) {
          maxGasTx = gasUsed;
          maxGasTxIndex = index;
        }
        if (index === 0 || gasUsed < minGasTx) {
          minGasTx = gasUsed;
          minGasTxIndex = index;
        }

        totalGasCost += txGasCost;
        totalGasPrice += gasPrice;
        totalGasUsed += gasUsed;
      }

      const avgGasPrice = totalGasPrice / BigInt(rawTransactions.length);
      const gasUsedPerTx = Number(totalGasUsed) / rawTransactions.length;
      sumOfAvgTxGas += gasUsedPerTx;
      feedsCounter++;
      console.log('numberOfTransactions:', rawTransactions.length);
      // console.log(aggregatorAddress);
      // console.log('totalGasCost:', Number(totalGasCost));
      // console.log('avgGasPrice:', Number(avgGasPrice));
      // console.log('totalGasUsed:', Number(totalGasUsed));
      console.log('Name: ', feed.name);
      console.log(chalk.blue('gasUsedPerTx:', Number(gasUsedPerTx)));
      console.log(chalk.green('minGasTx:', Number(minGasTx)));
      console.log(chalk.green('maxGasTx:', Number(maxGasTx)));
      //   console.log(chalk.green('minGasTxIndex:', Number(minGasTxIndex)));
      //   console.log(chalk.green('maxGasTxIndex:', Number(maxGasTxIndex)));
      //   console.log(
      //     chalk.green('minGasTx:', rawTransactions[minGasTxIndex].transactionHash),
      //   );
      //   console.log(
      //     chalk.green('maxGasTx:', rawTransactions[maxGasTxIndex].transactionHash),
      //   );
      //   console.log(
      //     chalk.green(
      //       'minGasTxGas:',
      //       Number(rawTransactions[minGasTxIndex].gasUsed),
      //     ),
      //   );
      //   console.log(
      //     chalk.green(
      //       'maxGasTxGas:',
      //       Number(rawTransactions[maxGasTxIndex].gasUsed),
      //     ),
      //   );
    }
    console.log(chalk.grey('--------------------------------------'));
  }

  console.log(chalk.blue('avgFeedGas', sumOfAvgTxGas / feedsCounter));
  console.log(feedsCounter, ' feeds');
};
main().catch(error => {
  console.error(chalk.red('Error running script:'), error);
});
