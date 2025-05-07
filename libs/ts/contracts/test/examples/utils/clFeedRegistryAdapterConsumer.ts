import { Addressable, ContractRunner } from 'ethers';
import { CLFeedRegistryAdapter__factory } from 'libs/ts/contracts/typechain';

export interface RegistryConfig {
  address: string | Addressable;
  abiJson: any;
  provider: ContractRunner;
}

async function getAddress(config: RegistryConfig): Promise<string> {
  return typeof config.address === 'string'
    ? config.address
    : await config.address.getAddress();
}

export const functions = {
  getDecimals: async (config: RegistryConfig, ...rest: string[]) => {
    const registry = CLFeedRegistryAdapter__factory.connect(
      await getAddress(config),
    );
    const decimals = await registry.decimals(rest[0], rest[1]);

    return decimals;
  },

  getDescription: async (config: RegistryConfig, ...rest: string[]) => {
    const registry = CLFeedRegistryAdapter__factory.connect(
      await getAddress(config),
    );
    const description = await registry.description(rest[0], rest[1]);

    return description;
  },

  getLatestAnswer: async (config: RegistryConfig, ...rest: string[]) => {
    const registry = CLFeedRegistryAdapter__factory.connect(
      await getAddress(config),
    );
    const latestAnswer = await registry.latestAnswer(rest[0], rest[1]);

    return latestAnswer;
  },

  getLatestRound: async (config: RegistryConfig, ...rest: string[]) => {
    const registry = CLFeedRegistryAdapter__factory.connect(
      await getAddress(config),
    );
    const latestRound = await registry.latestRound(rest[0], rest[1]);

    return latestRound;
  },

  getRoundData: async (
    config: RegistryConfig,
    ...rest: (string | number)[]
  ) => {
    const registry = CLFeedRegistryAdapter__factory.connect(
      await getAddress(config),
    );
    const roundData = await registry.getRoundData(
      rest[0] as string,
      rest[1] as string,
      rest[2] as number,
    );

    return roundData;
  },

  getLatestRoundData: async (config: RegistryConfig, ...rest: string[]) => {
    const registry = CLFeedRegistryAdapter__factory.connect(
      await getAddress(config),
    );
    const latestRoundData = await registry.latestRoundData(rest[0], rest[1]);
    return latestRoundData;
  },

  getFeed: async (config: RegistryConfig, ...rest: string[]) => {
    const registry = CLFeedRegistryAdapter__factory.connect(
      await getAddress(config),
    );
    const feed = await registry.getFeed(rest[0], rest[1]);

    return feed;
  },
};
