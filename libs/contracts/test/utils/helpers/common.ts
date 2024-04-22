import { BytesLike, ethers } from 'ethers';
import { ethers as hre, network } from 'hardhat';
import {
  DataFeedStoreGenericV1,
  DataFeedStoreGenericV2,
  DataFeedStoreV1,
  DataFeedStoreV2,
  DataFeedStoreV3,
  IDataFeedStoreGenericV1,
  IDataFeedStoreGenericV2,
  UpgradeableProxy,
} from '../../../typechain';
import { contractVersionLogger } from '../logger';
import { expect } from 'chai';
import { RpcStructLog } from 'hardhat/internal/hardhat-network/provider/output';

export type GenericDataFeedStore =
  | DataFeedStoreGenericV1
  | DataFeedStoreGenericV2;
export type DataFeedStore = DataFeedStoreV1 | DataFeedStoreV2 | DataFeedStoreV3;

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

export const setDataFeeds = async (
  genericContracts: GenericDataFeedStore[],
  contracts: DataFeedStore[],
  selector: string,
  valuesCount: number,
  start: number = 0,
) => {
  const keys = Array.from({ length: valuesCount }, (_, i) => i + start);
  const values = keys.map(key =>
    ethers.encodeBytes32String(`Hello, World! ${key}`),
  );

  const receipts = [];
  for (const contract of contracts) {
    receipts.push(await setter(contract, selector, keys, values));
  }

  let receiptsGeneric = [];
  for (const contract of genericContracts) {
    let receipt;
    if (isGenericV1(contract)) {
      receipt = await contract.setFeeds(keys, values);
    } else {
      receipt = await contract.setFeeds(
        ethers.solidityPacked(
          keys.map(() => ['uint32', 'bytes32']).flat(),
          keys.flatMap((key, i) => [key, values[i]]),
        ),
      );
    }

    receiptsGeneric.push(await receipt.wait());
  }

  return { receipts, receiptsGeneric, keys, values };
};

export const printGasUsage = async (
  logger: ReturnType<typeof contractVersionLogger>,
  receipts: any[],
  receiptsGeneric: any[],
): Promise<void> => {
  const table: { [key: string]: { gas: number; diff: number; '%': number } } =
    {};

  for (const receipt of receipts) {
    const version = logger(receipt.to, 'gas used', (data: string) => data);
    table[version] = { gas: Number(receipt?.gasUsed), diff: 0, '%': 0 };
  }
  for (const receipt of receiptsGeneric) {
    const version = logger(receipt.to, '', (data: string) => data);
    table[`[Generic ${version}] gas used`] = {
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
      const generic = receiptsGeneric.includes(receipt) ? 'Generic ' : '';
      console.log(
        `${[logger(receipt.to, `${generic}trace`, (data: string) => data)]}: `,
        res.structLogs.filter((log: RpcStructLog) => {
          return { op: log.op, gas: log.gas };
        }),
      );
    }
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

  const tx = await contract.deploymentTransaction()?.getTransaction();

  console.log(
    `${contractName} deployment gas used: `,
    +(await network.provider.send('eth_getTransactionReceipt', [tx?.hash]))
      .gasUsed,
  );

  return contract as T;
};
