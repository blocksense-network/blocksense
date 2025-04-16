import { Addressable, ContractRunner } from 'ethers';
import { ethers } from 'hardhat';
import { CLAggregatorAdapter__factory } from 'libs/ts/contracts/typechain';

interface AggregatorConfig {
  address: string;
  abiJson: any;
  provider: ContractRunner;
}

export const getDecimals = async (config: AggregatorConfig) => {
  const aggregator = CLAggregatorAdapter__factory.connect(config.address);
  const decimals = await aggregator.decimals();

  return decimals;
};

export const getDescription = async (config: AggregatorConfig) => {
  const aggregator = CLAggregatorAdapter__factory.connect(config.address);
  const description = await aggregator.description();
  return description;
};

export const getLatestAnswer = async (config: AggregatorConfig) => {
  const aggregator = CLAggregatorAdapter__factory.connect(config.address);
  const latestAnswer = await aggregator.latestAnswer();

  return latestAnswer;
};

export const getLatestRound = async (config: AggregatorConfig) => {
  const aggregator = CLAggregatorAdapter__factory.connect(config.address);
  const latestRound = await aggregator.latestRound();

  return latestRound;
};

export const getRoundData = async (
  config: AggregatorConfig,
  roundId: number,
) => {
  const aggregator = CLAggregatorAdapter__factory.connect(config.address);
  const roundData = await aggregator.getRoundData(roundId);

  return roundData;
};

export const getLatestRoundData = async (config: AggregatorConfig) => {
  const aggregator = CLAggregatorAdapter__factory.connect(config.address);
  const latestRoundData = await aggregator.latestRoundData();

  return latestRoundData;
};
