import { ContractRunner } from 'ethers';
import { CLFeedRegistryAdapter__factory } from 'libs/ts/contracts/typechain';

export interface RegistryConfig {
  address: string;
  abiJson: any;
  provider: ContractRunner;
}

export const functions = {
  getDecimals: async (config: RegistryConfig, base: string, quote: string) => {
    const registry = CLFeedRegistryAdapter__factory.connect(config.address);
    const decimals = await registry.decimals(base, quote);

    return decimals;
  },

  getDescription: async (
    config: RegistryConfig,
    base: string,
    quote: string,
  ) => {
    const registry = CLFeedRegistryAdapter__factory.connect(config.address);
    const description = await registry.description(base, quote);

    return description;
  },

  getLatestAnswer: async (
    config: RegistryConfig,
    base: string,
    quote: string,
  ) => {
    const registry = CLFeedRegistryAdapter__factory.connect(config.address);
    const latestAnswer = await registry.latestAnswer(base, quote);

    return latestAnswer;
  },

  getLatestRound: async (
    config: RegistryConfig,
    base: string,
    quote: string,
  ) => {
    const registry = CLFeedRegistryAdapter__factory.connect(config.address);
    const latestRound = await registry.latestRound(base, quote);

    return latestRound;
  },

  getRoundData: async (
    config: RegistryConfig,
    base: string,
    quote: string,
    roundId: number,
  ) => {
    const registry = CLFeedRegistryAdapter__factory.connect(config.address);
    const roundData = await registry.getRoundData(base, quote, roundId);

    return roundData;
  },

  getLatestRoundData: async (
    config: RegistryConfig,
    base: string,
    quote: string,
  ) => {
    const registry = CLFeedRegistryAdapter__factory.connect(config.address);
    const latestRoundData = await registry.latestRoundData(base, quote);

    return latestRoundData;
  },

  getFeed: async (config: RegistryConfig, base: string, quote: string) => {
    const registry = CLFeedRegistryAdapter__factory.connect(config.address);
    const feed = await registry.getFeed(base, quote);

    return feed;
  },
};
