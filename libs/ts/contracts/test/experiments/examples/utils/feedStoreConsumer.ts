import {
  Addressable,
  Contract,
  ContractRunner,
  solidityPacked,
  toBigInt,
} from 'ethers';

type EthersContractParams = [
  address: string | Addressable,
  abiJson: any,
  provider: ContractRunner,
];

export const getLatestAnswer = async (
  config: EthersContractParams,
  key: number,
) => {
  const historicalDataFeedStore = new Contract(...config);
  const data = '0x' + ((key | 0x80000000) >>> 0).toString(16).padStart(8, '0');

  const res = await config[2].call!({
    to: historicalDataFeedStore.target,
    data,
  });

  // value is 24 bytes
  const value = toBigInt(res.slice(0, 50));
  // timestamp is the trailing 8 bytes
  const timestamp = Number('0x' + res.slice(50, 66));

  return [value, timestamp];
};

export const getRoundData = async (
  config: EthersContractParams,
  key: number,
  roundId: number,
) => {
  const historicalDataFeedStore = new Contract(...config);

  const data = '0x' + ((key | 0x20000000) >>> 0).toString(16).padStart(8, '0');

  const res = await config[2].call!({
    to: historicalDataFeedStore.target,
    data: solidityPacked(['bytes4', 'uint256'], [data, roundId]),
  });

  // value is 24 bytes
  const value = toBigInt(res.slice(0, 50));
  // timestamp is the trailing 8 bytes
  const timestamp = Number('0x' + res.slice(50, 66));

  return [value, timestamp];
};

export const getLatestRound = async (
  config: EthersContractParams,
  key: number,
) => {
  const historicalDataFeedStore = new Contract(...config);
  const data = '0x' + ((key | 0x40000000) >>> 0).toString(16).padStart(8, '0');

  const res = await config[2].call!({
    to: historicalDataFeedStore.target,
    data,
  });

  const round = '0x' + res.slice(66);

  return toBigInt(round);
};

export const getLatestRoundData = async (
  config: EthersContractParams,
  key: number,
) => {
  const historicalDataFeedStore = new Contract(...config);
  const data = '0x' + ((key | 0xc0000000) >>> 0).toString(16).padStart(8, '0');

  const res = await config[2].call!({
    to: historicalDataFeedStore.target,
    data,
  });

  const value = toBigInt(res.slice(0, 50));
  const timestamp = Number('0x' + res.slice(50, 66));
  const round = Number('0x' + res.slice(66));

  return [value, timestamp, round];
};
