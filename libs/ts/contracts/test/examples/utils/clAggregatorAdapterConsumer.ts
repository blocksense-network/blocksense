import { Addressable, ContractRunner } from 'ethers';
import { ethers } from 'hardhat';

interface AggregatorConfig {
  address: string | Addressable;
  abiJson: any;
  provider: ContractRunner;
}

export const getDecimals = async (config: AggregatorConfig) => {
  const aggregator = new ethers.Contract(
    config.address,
    config.abiJson,
    config.provider,
  );
  const decimals = await aggregator.decimals();

  return decimals;
};

export const getDescription = async (config: AggregatorConfig) => {
  const aggregator = new ethers.Contract(
    config.address,
    config.abiJson,
    config.provider,
  );
  const description = await aggregator.description();

  return description;
};

export const getLatestAnswer = async (config: AggregatorConfig) => {
  const aggregator = new ethers.Contract(
    config.address,
    config.abiJson,
    config.provider,
  );
  const latestAnswer = await aggregator.latestAnswer();

  return latestAnswer;
};

export const getLatestRound = async (config: AggregatorConfig) => {
  const aggregator = new ethers.Contract(
    config.address,
    config.abiJson,
    config.provider,
  );
  const latestRound = await aggregator.latestRound();

  return latestRound;
};

export const getRoundData = async (
  config: AggregatorConfig,
  roundId: number,
) => {
  const aggregator = new ethers.Contract(
    config.address,
    config.abiJson,
    config.provider,
  );
  const roundData = await aggregator.getRoundData(roundId);

  return roundData;
};

export const getLatestRoundData = async (config: AggregatorConfig) => {
  const aggregator = new ethers.Contract(
    config.address,
    config.abiJson,
    config.provider,
  );
  const latestRoundData = await aggregator.latestRoundData();

  return latestRoundData;
};
