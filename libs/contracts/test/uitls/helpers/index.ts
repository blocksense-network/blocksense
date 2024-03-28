import { ethers } from 'ethers';
import { network } from 'hardhat';
import {
  DataFeedStoreGeneric,
  DataFeedStoreGenericV2,
  DataFeedStoreV1,
  DataFeedStoreV2,
  DataFeedStoreV3,
  IDataFeedStoreGeneric,
  IDataFeedStoreGenericV2,
} from '../../../typechain';

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
) => {
  const txHash = await network.provider.send('eth_sendTransaction', [
    {
      to: await contract.getAddress(),
      data: ethers.solidityPacked(
        ['bytes4', ...keys.map(() => ['uint32', 'bytes32']).flat()],
        [selector, ...keys.flatMap((key, i) => [key, values[i]])],
      ),
    },
  ]);

  return network.provider.send('eth_getTransactionReceipt', [txHash]);
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

  return { receipts, receiptsGeneric };
};
