import { Addressable, ContractRunner } from 'ethers';
import { ethers } from 'hardhat';

interface RegistryConfig {
  address: string | Addressable;
  abiJson: any;
  provider: ContractRunner;
}

export const getDecimals = async (
  config: RegistryConfig,
  base: string,
  quote: string,
) => {
  const registry = new ethers.Contract(
    config.address,
    config.abiJson,
    config.provider,
  );
  const decimals = await registry.decimals(base, quote);

  return decimals;
};

export const getDescription = async (
  config: RegistryConfig,
  base: string,
  quote: string,
) => {
  const registry = new ethers.Contract(
    config.address,
    config.abiJson,
    config.provider,
  );
  const description = await registry.description(base, quote);

  return description;
};

export const getLatestAnswer = async (
  config: RegistryConfig,
  base: string,
  quote: string,
) => {
  const registry = new ethers.Contract(
    config.address,
    config.abiJson,
    config.provider,
  );
  const latestAnswer = await registry.latestAnswer(base, quote);

  return latestAnswer;
};

export const getLatestRound = async (
  config: RegistryConfig,
  base: string,
  quote: string,
) => {
  const registry = new ethers.Contract(
    config.address,
    config.abiJson,
    config.provider,
  );
  const latestRound = await registry.latestRound(base, quote);

  return latestRound;
};

export const getRoundData = async (
  config: RegistryConfig,
  base: string,
  quote: string,
  roundId: number,
) => {
  const registry = new ethers.Contract(
    config.address,
    config.abiJson,
    config.provider,
  );
  const roundData = await registry.getRoundData(base, quote, roundId);

  return roundData;
};

export const getLatestRoundData = async (
  config: RegistryConfig,
  base: string,
  quote: string,
) => {
  const registry = new ethers.Contract(
    config.address,
    config.abiJson,
    config.provider,
  );
  const latestRoundData = await registry.latestRoundData(base, quote);

  return latestRoundData;
};

export const getFeed = async (
  config: RegistryConfig,
  base: string,
  quote: string,
) => {
  const registry = new ethers.Contract(
    config.address,
    config.abiJson,
    config.provider,
  );
  const feed = await registry.getFeed(base, quote);

  return feed;
};
