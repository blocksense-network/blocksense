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

export type ContractData = typeof ContractDataSchema.Type;

export const CLAggregatorAdapterDataSchema = S.Struct({
  description: S.String,
  address: ethereumAddress,
  base: S.NullOr(ethereumAddress),
  quote: S.NullOr(ethereumAddress),
  constructorArgs: FunctionArgs,
});

export type CLAggregatorAdapterData = typeof CLAggregatorAdapterDataSchema.Type;

const CoreContractsSchemaV1 = S.mutable(
  S.Struct({
    HistoricalDataFeedStoreV2: ContractDataSchema,
    UpgradeableProxy: ContractDataSchema,
    CLFeedRegistryAdapter: ContractDataSchema,
  }),
);

export type CoreContractsV1 = typeof CoreContractsSchemaV1.Type;

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

export type CoreContractsV2 = typeof CoreContractsSchemaV2.Type;

const ContractsConfigSchemaV1 = S.mutable(
  S.Struct({
    coreContracts: CoreContractsSchemaV1,
    CLAggregatorAdapter: S.mutable(S.Array(CLAggregatorAdapterDataSchema)),
    SafeMultisig: ethereumAddress,
  }),
);

export type ContractsConfigV1 = typeof ContractsConfigSchemaV1.Type;

const ContractsConfigSchemaV2 = S.mutable(
  S.Struct({
    coreContracts: CoreContractsSchemaV2,
    CLAggregatorAdapter: S.mutable(S.Array(CLAggregatorAdapterDataSchema)),
    SequencerMultisig: ethereumAddress,
    AdminMultisig: ethereumAddress,
  }),
);

export type ContractsConfigV2 = typeof ContractsConfigSchemaV2.Type;

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

export type DeploymentConfigV1 = typeof DeploymentConfigSchemaV1.Type;

export const DeploymentConfigSchemaV2 = S.mutable(
  S.Struct({
    name: networkName,
    chainId: chainId,
    contracts: ContractsConfigSchemaV2,
  }),
);

export type DeploymentConfigV2 = typeof DeploymentConfigSchemaV2.Type;

export const decodeDeploymentConfigV1 = S.decodeUnknownSync(
  DeploymentConfigSchemaV1,
);

export const decodeDeploymentConfigV2 = S.decodeUnknownSync(
  DeploymentConfigSchemaV2,
);
