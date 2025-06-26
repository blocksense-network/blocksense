import { Contract } from 'ethers';

type EthersContractParams = ConstructorParameters<typeof Contract>;

export const getDecimals = (config: EthersContractParams) => {
  const aggregator = new Contract(...config);
  return aggregator.decimals();
};

export const getDescription = (config: EthersContractParams) => {
  const aggregator = new Contract(...config);
  return aggregator.description();
};

export const getLatestAnswer = (config: EthersContractParams) => {
  const aggregator = new Contract(...config);
  return aggregator.latestAnswer();
};

export const getLatestRound = (config: EthersContractParams) => {
  const aggregator = new Contract(...config);
  return aggregator.latestRound();
};

export const getRoundData = (config: EthersContractParams, roundId: number) => {
  const aggregator = new Contract(...config);
  return aggregator.getRoundData(roundId);
};

export const getLatestRoundData = (config: EthersContractParams) => {
  const aggregator = new Contract(...config);
  return aggregator.latestRoundData();
};
