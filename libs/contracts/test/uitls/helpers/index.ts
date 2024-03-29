import { ethers } from 'ethers';
import { ethers as hre, network } from 'hardhat';
import {
  DataFeedStoreGeneric,
  DataFeedStoreGenericV2,
  DataFeedStoreV1,
  DataFeedStoreV2,
  DataFeedStoreV3,
  IDataFeedStoreGeneric,
  IDataFeedStoreGenericV2,
} from '../../../typechain';
import { contractVersionLogger } from '../logger';
import { DataFeedConsumer } from './consumerGasHelpers';
import { expect } from 'chai';

export type IGenericDataFeedStore =
  | IDataFeedStoreGeneric
  | IDataFeedStoreGenericV2;
export type GenericDataFeedStore =
  | DataFeedStoreGeneric
  | DataFeedStoreGenericV2;
export type DataFeedStore = DataFeedStoreV1 | DataFeedStoreV2 | DataFeedStoreV3;

export const getter = async (contract: DataFeedStore, selector: string) => {
  const msgData = ethers.solidityPacked(['bytes4'], [selector]);
  return network.provider.send('eth_call', [
    {
      to: await contract.getAddress(),
      data: msgData,
    },
    'latest',
  ]);
};

export const setter = async (
  contract: DataFeedStore,
  selector: string,
  keys: number[],
  values: string[],
  ...args: any[]
) => {
  const params: any = {};
  params.to = await contract.getAddress();
  params.data = ethers.solidityPacked(
    ['bytes4', ...keys.map(() => ['uint32', 'bytes32']).flat()],
    [selector, ...keys.flatMap((key, i) => [key, values[i]])],
  );
  for (const arg of args) {
    Object.assign(params, arg);
  }
  const txHash = await network.provider.send('eth_sendTransaction', [params]);

  return network.provider.send('eth_getTransactionReceipt', [txHash]);
};

export const checkSetValues = async (
  contracts: DataFeedStore[],
  versionedLogger: ReturnType<typeof contractVersionLogger>,
  keys: number[],
  values: string[],
) => {
  for (const contract of contracts) {
    const contractVersion = versionedLogger(
      contract,
      '',
      (data: string) => data,
    ) as string;
    for (let i = 0; i < keys.length; i++) {
      let selector;
      if (contractVersion.includes('V1')) {
        selector = getV1Selector(keys[i]);
      } else {
        selector = getV2Selector(keys[i]);
      }

      const value = await getter(contract, selector);
      expect(value).to.be.eq(values[i]);
    }
  }
};

export const checkGenericSetValues = async (
  genericContracts: IGenericDataFeedStore[],
  keys: number[],
  values: string[],
) => {
  for (const genericContract of genericContracts) {
    for (let i = 0; i < keys.length; i++) {
      const value = await genericContract.getDataFeed(keys[i]);
      expect(value).to.be.eq(values[i]);
    }
  }
};

export const getV1Selector = (key: number): string => {
  return '0x' + (key >>> 0).toString(16).padStart(8, '0');
};

export const getV2Selector = (key: number): string => {
  return '0x' + ((key | 0x80000000) >>> 0).toString(16).padStart(8, '0');
};

function isGenericV1(
  contract: IDataFeedStoreGeneric | IDataFeedStoreGenericV2,
): contract is IDataFeedStoreGeneric {
  return (
    (contract as IDataFeedStoreGeneric).interface.getFunction('setFeeds').inputs
      .length === 2
  );
}

export const setDataFeeds = async (
  genericContracts: IGenericDataFeedStore[],
  contracts: DataFeedStore[],
  selector: string,
  valuesCount: number,
  start: number = 0,
) => {
  const keys = Array.from({ length: valuesCount }, (_, i) => i + start);
  const values = Array.from({ length: valuesCount }, (_, i) =>
    ethers.zeroPadBytes(ethers.toUtf8Bytes(`Hello, World! ${i}`), 32),
  );

  const receipts = [];
  for (const contract of contracts) {
    receipts.push({
      contract,
      receipt: await setter(contract, selector, keys, values),
    });
  }

  let receiptsGeneric = [];
  for (const contract of genericContracts) {
    let receipt;
    let version = 1;
    if (isGenericV1(contract)) {
      receipt = await contract.setFeeds(keys, values);
    } else {
      version = 2;
      receipt = await contract.setFeeds(
        ethers.solidityPacked(
          keys.map(() => ['uint32', 'bytes32']).flat(),
          keys.flatMap((key, i) => [key, values[i]]),
        ),
      );
    }

    receiptsGeneric.push({
      contractVersion: version,
      receipt: await receipt.wait(),
    });
  }

  return { receipts, receiptsGeneric, keys, values };
};

export const printGasUsage = (
  logger: ReturnType<typeof contractVersionLogger>,
  receipts: { contract: DataFeedStore | DataFeedConsumer; receipt: any }[],
  receiptsGeneric: { contractVersion: number; receipt: any }[],
): void => {
  const table: { [key: string]: { gas: number; diff: number; '%': number } } =
    {};

  for (const { receipt, contract } of receipts) {
    const version = logger(contract, 'gas used', (data: string) => data);
    table[version] = { gas: Number(receipt?.gasUsed), diff: 0, '%': 0 };
  }
  for (const { contractVersion, receipt } of receiptsGeneric) {
    table[`[Generic V${contractVersion}] gas used`] = {
      gas: Number(receipt?.gasUsed),
      diff: 0,
      '%': 0,
    };
  }

  for (const key in table) {
    table[key].diff = table[key].gas - table['[Generic V1] gas used'].gas;
    table[key]['%'] = +(
      (table[key].diff / table['[Generic V1] gas used'].gas) *
      100
    ).toFixed(2);
  }

  console.table(table);
};

export const deployContract = async <T>(
  contractName: string,
  ...args: any[]
): Promise<T> => {
  const contractFactory = await hre.getContractFactory(contractName);
  const contract = await contractFactory.deploy(...args);
  await contract.waitForDeployment();

  const tx2 = await contract.deploymentTransaction()?.getTransaction();

  console.log(
    `${contractName} deployment gas used: `,
    +(await network.provider.send('eth_getTransactionReceipt', [tx2?.hash]))
      .gasUsed,
  );

  return contract as T;
};
