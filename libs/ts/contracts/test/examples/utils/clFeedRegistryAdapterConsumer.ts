import { Contract } from 'ethers';

type EthersContractParams = ConstructorParameters<typeof Contract>;

export const getDecimals = (
  config: EthersContractParams,
  base: string,
  quote: string,
) => {
  const registry = new Contract(...config);
  return registry.decimals(base, quote);
};

export const getDescription = (
  config: EthersContractParams,
  base: string,
  quote: string,
) => {
  const registry = new Contract(...config);
  return registry.description(base, quote);
};

export const getLatestAnswer = (
  config: EthersContractParams,
  base: string,
  quote: string,
) => {
  const registry = new Contract(...config);
  return registry.latestAnswer(base, quote);
};

export const getLatestRound = (
  config: EthersContractParams,
  base: string,
  quote: string,
) => {
  const registry = new Contract(...config);
  return registry.latestRound(base, quote);
};

export const getRoundData = (
  config: EthersContractParams,
  base: string,
  quote: string,
  roundId: number,
) => {
  const registry = new Contract(...config);
  return registry.getRoundData(base, quote, roundId);
};

export const getLatestRoundData = (
  config: EthersContractParams,
  base: string,
  quote: string,
) => {
  const registry = new Contract(...config);
  return registry.latestRoundData(base, quote);
};

export const getFeed = (
  config: EthersContractParams,
  base: string,
  quote: string,
) => {
  const registry = new Contract(...config);
  return registry.getFeed(base, quote);
};
