import { Addressable, ContractRunner } from 'ethers';
import { ethers } from 'hardhat';

interface DataFeedStoreConfig {
  address: string | Addressable;
  abiJson: any;
  provider: ContractRunner;
}

export const getLatestAnswer = async (
  config: DataFeedStoreConfig,
  key: number,
) => {
  const historicalDataFeedStore = new ethers.Contract(
    config.address,
    config.abiJson,
    config.provider,
  );
  const data = '0x' + ((key | 0x80000000) >>> 0).toString(16).padStart(8, '0');

  const res = await config.provider.call!({
    to: historicalDataFeedStore.target,
    data,
  });

  // value is 24 bytes
  const value = ethers.toBigInt(res.slice(0, 50));
  // timestamp is the trailing 8 bytes
  const timestamp = Number('0x' + res.slice(50, 66));

  return [value, timestamp];
};

export const getRoundData = async (
  config: DataFeedStoreConfig,
  key: number,
  roundId: number,
) => {
  const historicalDataFeedStore = new ethers.Contract(
    config.address,
    config.abiJson,
    config.provider,
  );

  const data = '0x' + ((key | 0x20000000) >>> 0).toString(16).padStart(8, '0');

  const res = await config.provider.call!({
    to: historicalDataFeedStore.target,
    data: ethers.solidityPacked(['bytes4', 'uint256'], [data, roundId]),
  });

  // value is 24 bytes
  const value = ethers.toBigInt(res.slice(0, 50));
  // timestamp is the trailing 8 bytes
  const timestamp = Number('0x' + res.slice(50, 66));

  return [value, timestamp];
};

export const getLatestRound = async (
  config: DataFeedStoreConfig,
  key: number,
) => {
  const historicalDataFeedStore = new ethers.Contract(
    config.address,
    config.abiJson,
    config.provider,
  );
  const data = '0x' + ((key | 0x40000000) >>> 0).toString(16).padStart(8, '0');

  const res = await config.provider.call!({
    to: historicalDataFeedStore.target,
    data,
  });

  const round = '0x' + res.slice(66);

  return ethers.toBigInt(round);
};

export const getLatestRoundData = async (
  config: DataFeedStoreConfig,
  key: number,
) => {
  const historicalDataFeedStore = new ethers.Contract(
    config.address,
    config.abiJson,
    config.provider,
  );
  const data = '0x' + ((key | 0xc0000000) >>> 0).toString(16).padStart(8, '0');

  const res = await config.provider.call!({
    to: historicalDataFeedStore.target,
    data,
  });

  const value = ethers.toBigInt(res.slice(0, 50));
  const timestamp = Number('0x' + res.slice(50, 66));
  const round = Number('0x' + res.slice(66));

  return [value, timestamp, round];
};
