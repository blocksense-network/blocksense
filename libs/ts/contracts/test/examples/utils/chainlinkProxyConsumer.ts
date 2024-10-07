import { Addressable, ContractRunner } from 'ethers';
import { ethers } from 'hardhat';

interface ChainlinkProxyConfig {
  address: string | Addressable;
  abiJson: any;
  provider: ContractRunner;
}

export const getDecimals = async (config: ChainlinkProxyConfig) => {
  const chainlinkProxy = new ethers.Contract(
    config.address,
    config.abiJson,
    config.provider,
  );
  const decimals = await chainlinkProxy.decimals();

  return decimals;
};

export const getDescription = async (config: ChainlinkProxyConfig) => {
  const chainlinkProxy = new ethers.Contract(
    config.address,
    config.abiJson,
    config.provider,
  );
  const description = await chainlinkProxy.description();

  return description;
};

export const getLatestAnswer = async (config: ChainlinkProxyConfig) => {
  const chainlinkProxy = new ethers.Contract(
    config.address,
    config.abiJson,
    config.provider,
  );
  const latestAnswer = await chainlinkProxy.latestAnswer();

  return latestAnswer;
};

export const getLatestRound = async (config: ChainlinkProxyConfig) => {
  const chainlinkProxy = new ethers.Contract(
    config.address,
    config.abiJson,
    config.provider,
  );
  const latestRound = await chainlinkProxy.latestRound();

  return latestRound;
};

export const getRoundData = async (
  config: ChainlinkProxyConfig,
  roundId: number,
) => {
  const chainlinkProxy = new ethers.Contract(
    config.address,
    config.abiJson,
    config.provider,
  );
  const roundData = await chainlinkProxy.getRoundData(roundId);

  return roundData;
};

export const getLatestRoundData = async (config: ChainlinkProxyConfig) => {
  const chainlinkProxy = new ethers.Contract(
    config.address,
    config.abiJson,
    config.provider,
  );
  const latestRoundData = await chainlinkProxy.latestRoundData();

  return latestRoundData;
};
