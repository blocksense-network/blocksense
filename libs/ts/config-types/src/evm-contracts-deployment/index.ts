import { Schema as S } from 'effect';

import {
  chainId,
  ethereumAddress,
  networkName,
} from '@blocksense/base-utils/evm';

const ParameterType = S.Union(ethereumAddress, S.String, S.Number, S.Boolean);

const FunctionArgs = S.Array(ParameterType);

const ContractDataSchema = S.Struct({
  address: ethereumAddress,
  constructorArgs: FunctionArgs,
});

export type ContractData = S.Schema.Type<typeof ContractDataSchema>;

export const CLAggregatorAdapterDataSchema = S.Struct({
  description: S.String,
  address: ethereumAddress,
  base: S.NullOr(ethereumAddress),
  quote: S.NullOr(ethereumAddress),
  constructorArgs: FunctionArgs,
});

export type CLAggregatorAdapterData = S.Schema.Type<
  typeof CLAggregatorAdapterDataSchema
>;

const CoreContractsSchema = S.mutable(
  S.Struct({
    HistoricalDataFeedStoreV2: ContractDataSchema,
    UpgradeableProxy: ContractDataSchema,
    CLFeedRegistryAdapter: ContractDataSchema,
  }),
);

export type CoreContracts = S.Schema.Type<typeof CoreContractsSchema>;

const ContractsConfigSchema = S.mutable(
  S.Struct({
    coreContracts: CoreContractsSchema,
    CLAggregatorAdapter: S.mutable(S.Array(CLAggregatorAdapterDataSchema)),
    SafeMultisig: ethereumAddress,
  }),
);

export type ContractsConfig = S.Schema.Type<typeof ContractsConfigSchema>;

export const DeploymentConfigSchema = S.mutable(
  S.Record({
    key: networkName,
    value: S.UndefinedOr(
      S.Struct({
        chainId: chainId,
        contracts: ContractsConfigSchema,
      }),
    ),
  }),
);

export type DeploymentConfig = S.Schema.Type<typeof DeploymentConfigSchema>;

export const decodeDeploymentConfig = S.decodeUnknownSync(
  DeploymentConfigSchema,
);
