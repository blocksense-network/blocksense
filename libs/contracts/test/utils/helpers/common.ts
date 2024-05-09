import { BaseContract, ethers } from 'ethers';
import { ethers as hre, network } from 'hardhat';
import {
  Consumer as BaseConsumer,
  DataFeedStoreGenericV1,
  DataFeedStoreGenericV2,
  DataFeedStoreV1,
  DataFeedStoreV2,
  DataFeedStoreV3,
  HistoricConsumer,
  HistoricDataFeedStoreGenericV1,
  HistoricDataFeedStoreV1,
  HistoricDataFeedStoreV2,
} from '../../../typechain';
import { RpcStructLog } from 'hardhat/internal/hardhat-network/provider/output';
import { IBaseWrapper, IConsumerWrapper, IWrapper } from '../wrappers';

export type GenericDataFeedStore =
  | DataFeedStoreGenericV1
  | DataFeedStoreGenericV2;
export type DataFeedStore = DataFeedStoreV1 | DataFeedStoreV2 | DataFeedStoreV3;

export type DataFeed = DataFeedStore | GenericDataFeedStore;

export type HistoricDataFeedStore =
  | HistoricDataFeedStoreV1
  | HistoricDataFeedStoreV2;
export type GenericHistoricDataFeedStore = HistoricDataFeedStoreGenericV1;

export type Consumer = BaseConsumer | HistoricConsumer;

export interface TransmissionData {
  value: string;
  timestamp: bigint;
}

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

  const table: { [key: string]: { gas: number; diff: number; '%': number } } =
    {};

  for (const receipt of receipts) {
    const version = map[ethers.getAddress(receipt.to)].getName();
    table[version] = { gas: Number(receipt?.gasUsed), diff: 0, '%': 0 };
  }

  const genericV1TableObj = {
    gas: Number(receiptsGeneric[0]?.gasUsed),
    diff: 0,
    '%': 0,
  };
  for (const receipt of receiptsGeneric) {
    const version = map[ethers.getAddress(receipt.to)].getName();
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
        receipt.transactionHash,
        {
          disableMemory: true,
          disableStorage: true,
          disableStack: true,
        },
      ]);
      console.log(
        `${map[ethers.getAddress(receipt.to)].getName()} trace:`,
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

export const initConsumerWrappers = async <
  C extends BaseContract,
  B extends BaseContract,
  T extends new (...args: any[]) => IConsumerWrapper<C, B>,
>(
  wrappers: IConsumerWrapper<C, B>[],
  classes: T[],
) => {
  for (const c of classes) {
    const contract = new c();
    await contract.init();
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
  const map: Record<string, IBaseWrapper<G | B>> = {};
  for (const wrapper of [...genericWrappers, ...wrappers]) {
    map[wrapper.contract.target.toString()] = wrapper;
  }

  return map;
};
