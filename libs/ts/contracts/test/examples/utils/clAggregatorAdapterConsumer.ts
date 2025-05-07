import { Addressable, ContractRunner } from 'ethers';
import { get } from 'http';
import { CLAggregatorAdapter__factory } from 'libs/ts/contracts/typechain';

export interface AggregatorConfig {
  address: string | Addressable;
  abiJson: any;
  provider: ContractRunner;
}

async function getAddress(config: AggregatorConfig): Promise<string> {
  return typeof config.address === 'string'
    ? config.address
    : await config.address.getAddress();
}

export const functions = {
  getDecimals: async (config: AggregatorConfig) => {
    const aggregator = CLAggregatorAdapter__factory.connect(
      await getAddress(config),
    );
    const decimals = await aggregator.decimals();

    return decimals;
  },

  getDescription: async (config: AggregatorConfig) => {
    const aggregator = CLAggregatorAdapter__factory.connect(
      await getAddress(config),
    );
    const description = await aggregator.description();

    return description;
  },

  getLatestAnswer: async (config: AggregatorConfig) => {
    const aggregator = CLAggregatorAdapter__factory.connect(
      await getAddress(config),
    );
    const latestAnswer = await aggregator.latestAnswer();

    return latestAnswer;
  },

  getLatestRound: async (config: AggregatorConfig) => {
    const aggregator = CLAggregatorAdapter__factory.connect(
      await getAddress(config),
    );
    const latestRound = await aggregator.latestRound();

    return latestRound;
  },

  getRoundData: async (config: AggregatorConfig, ...rest: number[]) => {
    const aggregator = CLAggregatorAdapter__factory.connect(
      await getAddress(config),
    );
    const roundData = await aggregator.getRoundData(rest[0]);

    return roundData;
  },

  getLatestRoundData: async (config: AggregatorConfig) => {
    const aggregator = CLAggregatorAdapter__factory.connect(
      await getAddress(config),
    );
    const latestRoundData = await aggregator.latestRoundData();

    return latestRoundData;
  },
};
