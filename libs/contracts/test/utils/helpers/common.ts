import { BytesLike, ethers } from 'ethers';
import { ethers as hre, network } from 'hardhat';
import {
  DataFeedStoreGenericV1,
  DataFeedStoreGenericV2,
  DataFeedStoreV1,
  DataFeedStoreV2,
  DataFeedStoreV3,
  HistoricDataFeedStoreGenericV1,
  HistoricDataFeedStoreV1,
  HistoricDataFeedStoreV2,
  IDataFeedStoreGenericV1,
  IDataFeedStoreGenericV2,
  UpgradeableProxy,
} from '../../../typechain';
import { contractVersionLogger } from '../logger';
import { expect } from 'chai';
import { RpcStructLog } from 'hardhat/internal/hardhat-network/provider/output';
import { IWrapper } from '../wrappers/IWrapper';

export type GenericDataFeedStore =
  | DataFeedStoreGenericV1
  | DataFeedStoreGenericV2;
export type DataFeedStore = DataFeedStoreV1 | DataFeedStoreV2 | DataFeedStoreV3;

export type HistoricDataFeedStore =
  | HistoricDataFeedStoreV1
  | HistoricDataFeedStoreV2;
export type GenericHistoricDataFeedStore = HistoricDataFeedStoreGenericV1;

export const getter = async (
  contract: DataFeedStore,
  selector: string,
  ...args: any[]
): Promise<string> => {
  const params: any = {};
  params.to = await contract.getAddress();
  params.data = ethers.solidityPacked(['bytes4'], [selector]);

  for (const arg of args) {
    Object.assign(params, arg);
  }

  return network.provider.send('eth_call', [params, 'latest']);
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
  contracts: DataFeedStore[] | UpgradeableProxy[],
  versionedLogger: ReturnType<typeof contractVersionLogger>,
  keys: number[],
  values: string[],
) => {
  for (const contract of contracts) {
    const contractVersion = versionedLogger(
      contract.target.toString(),
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
  genericContracts: GenericDataFeedStore[],
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

export enum HISTORIC_SELECTORS {
  GET_LATEST_VALUE = 0x80000000,
  GET_LATEST_COUNTER = 0x40000000,
  GET_VALUE_AT_COUNTER = 0x20000000,
}
export const getHistoricSelector = (
  type: HISTORIC_SELECTORS,
  key: number,
): string => {
  return '0x' + ((key | type) >>> 0).toString(16).padStart(8, '0');
};

function isGenericV1(
  contract: IDataFeedStoreGenericV1 | IDataFeedStoreGenericV2,
): contract is IDataFeedStoreGenericV1 {
  return (
    (contract as IDataFeedStoreGenericV1).interface.getFunction('setFeeds')
      .inputs.length === 2
  );
}

export const setDataFeeds = async <
  G extends ethers.BaseContract,
  B extends ethers.BaseContract,
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

export const printGasUsage = async <T extends ethers.BaseContract>(
  map: Record<string, IWrapper<T>>,
  receipts: any[],
  receiptsGeneric: any[],
): Promise<void> => {
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
  U extends ethers.BaseContract,
  T extends new (...args: any[]) => IWrapper<U>,
>(
  storage: IWrapper<U>[],
  classes: T[],
): Promise<void> => {
  for (const c of classes) {
    const contract = new c();
    await contract.init();
    storage.push(contract);
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

export const abiDecode = (types: string[], data: BytesLike) => {
  expect(types.length).to.be.eq(data.length);

  const abi = new ethers.AbiCoder();
  return abi.decode(types, data);
};
