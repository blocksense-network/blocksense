import { BaseContract, ethers } from 'ethers';
import { ethers as hre, network } from 'hardhat';
import {
  Consumer as BaseConsumer,
  DataFeedStoreGenericV1,
  DataFeedStoreGenericV2,
  DataFeedStoreV1,
  DataFeedStoreV2,
  DataFeedStoreV3,
  HistoricalConsumer,
  HistoricalDataFeedStoreGenericV1,
  HistoricalDataFeedStoreV1,
  HistoricalDataFeedStoreV2,
  SportsConsumer as BaseSportsConsumer,
  SportsGenericConsumer,
} from '../../../../typechain';
import { RpcStructLog } from 'hardhat/internal/hardhat-network/provider/output';
import { IBaseWrapper, IWrapper } from '../../utils/wrappers';

export type GenericDataFeedStore =
  | DataFeedStoreGenericV1
  | DataFeedStoreGenericV2;
export type DataFeedStore = DataFeedStoreV1 | DataFeedStoreV2 | DataFeedStoreV3;

export type DataFeed = DataFeedStore | GenericDataFeedStore;

export type HistoricalDataFeedStore =
  | HistoricalDataFeedStoreV1
  | HistoricalDataFeedStoreV2;
export type GenericHistoricalDataFeedStore = HistoricalDataFeedStoreGenericV1;

export type Consumer = BaseConsumer | HistoricalConsumer;

export type SportsConsumer = BaseSportsConsumer | SportsGenericConsumer;

export interface TransmissionData {
  value: string;
  timestamp: bigint;
}

export const encodeData = (data: number[]) => {
  return (
    '0x' +
    ethers
      .solidityPacked(
        data.map(() => 'uint32'),
        data,
      )
      .slice(2)
      .padEnd(64, '0')
  );
};

export const setDataFeeds = async <
  G extends BaseContract,
  B extends BaseContract,
>(
  genericContractWrappers: IWrapper<G>[],
  contractWrappers: IWrapper<B>[],
  valuesCount: number,
  start: number = 0,
) => {
  const keys = Array.from({ length: valuesCount }, (_, i) => i + start);
  const values = keys.map(key =>
    ethers.encodeBytes32String(`Hello, World! ${key}`),
  );

  const receipts = [];
  for (const contract of contractWrappers) {
    receipts.push(await contract.setFeeds(keys, values));
  }

  const receiptsGeneric = [];
  for (const contract of genericContractWrappers) {
    receiptsGeneric.push(await contract.setFeeds(keys, values));
  }

  return { receipts, receiptsGeneric, keys, values };
};

export const setSportsDataFeeds = async <
  G extends BaseContract,
  B extends BaseContract,
>(
  genericContractWrappers: IWrapper<G>[],
  contractWrappers: IWrapper<B>[],
  valuesPerKeyCount: number[],
  start: number = 0,
) => {
  let prevKey = 0;
  const keys = Array.from({ length: valuesPerKeyCount.length }, (_, i) => {
    const res = prevKey + (i > 0 ? valuesPerKeyCount[i - 1] : 0) + start;
    prevKey = res;
    return res;
  });
  const values: string[] = [];
  const descriptions: string[] = keys.map(key =>
    ethers.encodeBytes32String(`Hello, World! ${key}`),
  );

  for (const valuesPerKey of valuesPerKeyCount) {
    const parsedValues: string[] = [];
    for (let i = 0; i < valuesPerKey; i++) {
      parsedValues.push(encodeData([i + start]));
    }
    values.push(parsedValues.join(';'));
  }

  const receipts = [];
  for (const contract of contractWrappers) {
    receipts.push(await contract.setFeeds(keys, values, descriptions));
  }

  const receiptsGeneric = [];
  for (const contract of genericContractWrappers) {
    receiptsGeneric.push(await contract.setFeeds(keys, values, descriptions));
  }

  return { receipts, receiptsGeneric, keys, values, descriptions };
};

export const printGasUsage = async <
  G extends BaseContract,
  B extends BaseContract,
>(
  genericWrappers: IBaseWrapper<G>[],
  wrappers: IBaseWrapper<B>[],
  receipts: any[],
  receiptsGeneric: any[],
): Promise<void> => {
  const map = createLogMap(genericWrappers, wrappers);

  await logTable(map, receipts, receiptsGeneric);
};

export const logTable = async (
  map: Record<string, string>,
  receipts: any[],
  receiptsGeneric: any[],
) => {
  const table: { [key: string]: { gas: number; diff: number; '%': number } } =
    {};

  for (const receipt of receipts) {
    const version = map[ethers.getAddress(receipt.to)];
    table[version] = { gas: Number(receipt?.gasUsed), diff: 0, '%': 0 };
  }

  const genericV1TableObj = {
    gas: Number(receiptsGeneric[0]?.gasUsed) || 1,
    diff: 0,
    '%': 0,
  };

  for (const receipt of receiptsGeneric) {
    const version = map[ethers.getAddress(receipt.to)];
    table[version] = { gas: Number(receipt?.gasUsed), diff: 0, '%': 0 };
  }

  for (const key in table) {
    table[key].diff = table[key].gas - genericV1TableObj.gas;
    table[key]['%'] = +(
      (table[key].diff / genericV1TableObj.gas) *
      100
    ).toFixed(2);
  }

  if (process.env.TRACE_TX === 'true') {
    for (const receipt of receipts.concat(receiptsGeneric)) {
      const res = await network.provider.send('debug_traceTransaction', [
        receipt.hash,
        {
          disableMemory: true,
          disableStorage: true,
          disableStack: true,
        },
      ]);
      console.log(
        `${map[ethers.getAddress(receipt.to)]} trace:`,
        res.structLogs.filter((log: RpcStructLog) => {
          return { op: log.op, gas: log.gas };
        }),
      );
    }
  }

  console.table(table);
};

export const initWrappers = async <
  U extends BaseContract,
  T extends new (...args: any[]) => IBaseWrapper<U>,
>(
  wrappers: IBaseWrapper<U>[],
  classes: T[],
  ...args: any[]
): Promise<void> => {
  for (const [index, c] of classes.entries()) {
    const contract = new c();
    await contract.init(...(args[index] || []));
    wrappers.push(contract);
  }
};

export const deployContract = async <T>(
  contractName: string,
  ...args: any[]
): Promise<T> => {
  let linkLibraries: any = {};
  args = args.filter(arg => {
    if (typeof arg === 'object' && arg.link) {
      linkLibraries = arg.link;
      return false;
    }
    return true;
  });

  const contractFactory = await hre.getContractFactory(
    contractName,
    Object.keys(linkLibraries).length > 0
      ? { libraries: linkLibraries }
      : undefined,
  );
  const contract = await contractFactory.deploy(...args);
  await contract.waitForDeployment();

  const tx = await contract.deploymentTransaction()?.getTransaction();

  console.log(
    `${contractName} deployment gas used: `,
    +(await network.provider.send('eth_getTransactionReceipt', [tx?.hash]))
      .gasUsed,
  );

  return contract as T;
};

export const createLogMap = <G extends BaseContract, B extends BaseContract>(
  genericWrappers: IBaseWrapper<G>[],
  wrappers: IBaseWrapper<B>[],
) => {
  const map: Record<string, string> = {};
  for (const wrapper of [...genericWrappers, ...wrappers]) {
    map[wrapper.contract.target.toString()] = wrapper.getName();
  }

  return map;
};

///////////////////////////
// Registry
///////////////////////////

export enum TOKENS {
  'ETH' = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  'BTC' = '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
  'USD' = '0x0000000000000000000000000000000000000348',
}

export async function assertRegistry<T>(
  thisArgs: T,
  callbackFn: (this: T, ...args: any[]) => any,
  description: string,
  ...args: any[]
): Promise<void> {
  const parsed = description.split('/');
  callbackFn.call(
    thisArgs,
    TOKENS[parsed[0] as keyof typeof TOKENS],
    TOKENS[parsed[1] as keyof typeof TOKENS],
    ...args,
  );
}
