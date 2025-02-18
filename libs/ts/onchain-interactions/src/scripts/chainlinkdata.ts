import axios, { AxiosResponse } from 'axios';
import Web3 from 'web3';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import { Transaction } from '../types';
import {
  getOptionalApiKey,
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
import { getChainlinkNetworkFilenameLinks } from '../../../../../apps/data-feeds-config-generator/src/chainlink-compatibility/types';
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

// // const starknetData =
// //   'https://reference-data-directory.vercel.app/feeds-ethereum-mainnet-starknet-1.json';

// // const starknetSepoliaData =
// //   'https://reference-data-directory.vercel.app/feeds-ethereum-testnet-sepolia-starknet-1.json';

// // const solanaData =
// //   'https://reference-data-directory.vercel.app/feeds-solana-mainnet.json';

// // const solanaDevnetData =
// //   'https://reference-data-directory.vercel.app/feeds-solana-devnet.json';

// const hederaData =
//   'https://reference-data-directory.vercel.app/feeds-hedera-mainnet.json';

// const hederaTestnetData =
//   'https://reference-data-directory.vercel.app/feeds-hedera-testnet.json';

// const aptosData = 'https://docs.chain.link/files/json/feeds-aptos-mainnet.json';

// // const aptosTestnetData =
// //   'https://docs.chain.link/files/json/feeds-aptos-testnet.json';

// const xLayerData =
//   'https://reference-data-directory.vercel.app/feeds-ethereum-mainnet-xlayer-1.json';

// const xLayerTestnetData =
//   'https://reference-data-directory.vercel.app/feeds-ethereum-testnet-sepolia-xlayer-1.json';

// const roninData =
//   'https://reference-data-directory.vercel.app/feeds-ronin-mainnet.json';

// const roninSaigonData =
//   'https://reference-data-directory.vercel.app/feeds-ronin-saigon-testnet.json';

// const botanixTestnetData =
//   'https://reference-data-directory.vercel.app/feeds-bitcoin-testnet-botanix.json';

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
// const main = async (): Promise<void> => {
//   const network: NetworkName = 'bsc-mainnet';
//   const dataAddress = getChainlinkNetworkFilenameLinks(network);
//   const jsonData = await fetchJson(dataAddress);
//   const api = networkMetadata[network].explorer?.apiUrl;
//   const apikey = getOptionalApiKey(network);

//   let sumOfAvgTxGas = 0;
//   let feedsCounter = 0;
//   for (const feed of jsonData) {
//     if (feed.contractVersion != 100) {
//       //   continue;
//       // }
//       let topic = feed.contractVersion == 4 ? v1Topic : v2Topic;

//       await delay(300);
//       const aggregatorAddress = feed.contractAddress;
//       const response = await axios.get(api, {
//         params: {
//           module: 'logs',
//           action: 'getLogs',
//           address: aggregatorAddress,
//           fromBlock: 0,
//           toBlock: 'latest',
//           topic0: topic,
//           sort: 'desc',
//           apikey,
//         },
//       });
//       // console.log();
//       // console.log(response.data);
//       const rawTransactions = response.data.result;
//       if (rawTransactions.length < 2) {
//         // need 2 tx to have a min and a max
//         continue;
//       }
//       let totalGasCost = BigInt(0);
//       let totalGasPrice = BigInt(0);
//       let totalGasUsed = BigInt(0);
//       let maxGasTx = BigInt(0);
//       let minGasTx = BigInt(0);
//       let maxGasTxIndex = 0;
//       let minGasTxIndex = 0;

//       // console.log(typeof rawTransactions);
//       if (typeof rawTransactions === 'string') {
//         console.log(rawTransactions);
//       }

//       for (const [index, tx] of rawTransactions.entries()) {
//         const gasUsed = BigInt(tx.gasUsed ?? tx.gas_used ?? tx.gas);
//         const gasPrice = BigInt(tx.gasPrice ?? tx.gas_price);
//         const txGasCost = gasUsed * gasPrice;

//         if (index === 0 || gasUsed > maxGasTx) {
//           maxGasTx = gasUsed;
//           maxGasTxIndex = index;
//         }
//         if (index === 0 || gasUsed < minGasTx) {
//           minGasTx = gasUsed;
//           minGasTxIndex = index;
//         }

//         totalGasCost += txGasCost;
//         totalGasPrice += gasPrice;
//         totalGasUsed += gasUsed;
//       }

//       const avgGasPrice = totalGasPrice / BigInt(rawTransactions.length);
//       const gasUsedPerTx = Number(totalGasUsed) / rawTransactions.length;
//       sumOfAvgTxGas += gasUsedPerTx;
//       feedsCounter++;
//       console.log('numberOfTransactions:', rawTransactions.length);
//       console.log('Name: ', feed.name);
//       console.log(chalk.blue('gasUsedPerTx:', Number(gasUsedPerTx)));
//       console.log(chalk.green('minGasTx:', Number(minGasTx)));
//       console.log(chalk.green('maxGasTx:', Number(maxGasTx)));
//     }
//     console.log(chalk.grey('--------------------------------------'));
//   }

//   console.log(chalk.blue('avgFeedGas', sumOfAvgTxGas / feedsCounter));
//   console.log(feedsCounter, ' feeds');
// };
// main().catch(error => {
//   console.error(chalk.red('Error running script:'), error);
// });

const main = async (): Promise<void> => {
  const network: NetworkName = 'blast-mainnet';
  const api = networkMetadata[network].explorer?.apiUrl;
  const apikey = getOptionalApiKey(network);

  await delay(300);
  // const aggregatorAddress = '0xa51738d1937FFc553d5070f43300B385AA2D9F55'; //bsc-mainnet
  // const aggregatorAddress = '0xFB1267A29C0aa19daae4a483ea895862A69e4AA5' //optimism-mainnet
  // const aggregatorAddress = '0x58fa68A373956285dDfb340EDf755246f8DfCA16'; //taiko-mainnet
  // const aggregatorAddress = '0x13433B1949d9141Be52Ae13Ad7e7E4911228414e'; //ink
  // const aggregatorAddress = '0xc44be6D00307c3565FDf753e852Fc003036cBc13'; //unichain
  const aggregatorAddress = '0x7262c8C5872A4Aa0096A8817cF61f5fa3c537330'; //blast
  const response = await axios.get(api, {
    params: {
      module: 'logs',
      action: 'getLogs',
      address: aggregatorAddress,
      fromBlock: 0,
      toBlock: 'latest',
      sort: 'desc',
      apikey,
    },
  });
  // console.log();
  // console.log(response.data);
  const rawTransactions = response.data.result;
  // if (rawTransactions.length < 2) {
  //   // need 2 tx to have a min and a max
  //   continue;
  // }
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

  const gasUsedPerTx = Number(totalGasUsed) / rawTransactions.length;
  console.log('numberOfTransactions:', rawTransactions.length);
  console.log(chalk.blue('gasUsedPerTx:', Number(gasUsedPerTx)));
  console.log(chalk.green('minGasTx:', Number(minGasTx)));
  console.log(chalk.green('maxGasTx:', Number(maxGasTx)));

  console.log(chalk.grey('--------------------------------------'));
};
main().catch(error => {
  console.error(chalk.red('Error running script:'), error);
});
