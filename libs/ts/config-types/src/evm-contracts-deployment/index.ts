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

const CoreContractsSchemaV1 = S.mutable(
  S.Struct({
    HistoricalDataFeedStoreV2: ContractDataSchema,
    UpgradeableProxy: ContractDataSchema,
    CLFeedRegistryAdapter: ContractDataSchema,
  }),
);

export type CoreContractsV1 = S.Schema.Type<typeof CoreContractsSchemaV1>;

const CoreContractsSchemaV2 = S.mutable(
  S.Struct({
    AggregatedDataFeedStore: ContractDataSchema,
    UpgradeableProxyADFS: ContractDataSchema,
    CLFeedRegistryAdapter: ContractDataSchema,
    AccessControl: ContractDataSchema,
    OnlySequencerGuard: S.UndefinedOr(ContractDataSchema),
    AdminExecutorModule: S.UndefinedOr(ContractDataSchema),
  }),
);

export type CoreContractsV2 = S.Schema.Type<typeof CoreContractsSchemaV2>;

const ContractsConfigSchemaV1 = S.mutable(
  S.Struct({
    coreContracts: CoreContractsSchemaV1,
    CLAggregatorAdapter: S.mutable(S.Array(CLAggregatorAdapterDataSchema)),
    SafeMultisig: ethereumAddress,
  }),
);

export type ContractsConfigV1 = S.Schema.Type<typeof ContractsConfigSchemaV1>;

const ContractsConfigSchemaV2 = S.mutable(
  S.Struct({
    coreContracts: CoreContractsSchemaV2,
    CLAggregatorAdapter: S.mutable(S.Array(CLAggregatorAdapterDataSchema)),
    SequencerMultisig: S.optional(ethereumAddress),
    AdminMultisig: ethereumAddress,
  }),
);

export type ContractsConfigV2 = S.Schema.Type<typeof ContractsConfigSchemaV2>;

export const DeploymentConfigSchemaV1 = S.mutable(
  S.Record({
    key: networkName,
    value: S.UndefinedOr(
      S.Struct({
        chainId: chainId,
        contracts: ContractsConfigSchemaV1,
      }),
    ),
  }),
);

export type DeploymentConfigV1 = S.Schema.Type<typeof DeploymentConfigSchemaV1>;

export const DeploymentConfigSchemaV2 = S.mutable(
  S.Struct({
    name: networkName,
    chainId: chainId,
    contracts: ContractsConfigSchemaV2,
  }),
);

export type DeploymentConfigV2 = S.Schema.Type<typeof DeploymentConfigSchemaV2>;

export const decodeDeploymentConfigV1 = S.decodeUnknownSync(
  DeploymentConfigSchemaV1,
);

export const decodeDeploymentConfigV2 = S.decodeUnknownSync(
  DeploymentConfigSchemaV2,
);
