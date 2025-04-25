import { Schema as S } from 'effect';

import {
  chainId,
  ethereumAddress,
  networkName,
} from '@blocksense/base-utils/evm';

const ParameterType = S.Union(S.String, S.Number, S.Boolean);
const FunctionArgs = S.Array(ParameterType);

const ContractDataSchema = S.Struct({
  address: ethereumAddress,
  constructorArgs: FunctionArgs,
});

export const CLAggregatorAdapterDataSchema = S.Struct({
  ...ContractDataSchema.fields,
  description: S.String,
  base: S.NullOr(ethereumAddress),
  quote: S.NullOr(ethereumAddress),
});

export type CLAggregatorAdapterData = typeof CLAggregatorAdapterDataSchema.Type;

const ContractsConfigSchemaV1 = S.mutable(
  S.Struct({
    coreContracts: S.mutable(
      S.Struct({
        HistoricalDataFeedStoreV2: ContractDataSchema,
        UpgradeableProxy: ContractDataSchema,
        CLFeedRegistryAdapter: ContractDataSchema,
      }),
    ),
    CLAggregatorAdapter: S.mutable(S.Array(CLAggregatorAdapterDataSchema)),
    SafeMultisig: ethereumAddress,
  }),
);

const ContractsConfigSchemaV2 = S.mutable(
  S.Struct({
    coreContracts: S.mutable(
      S.Struct({
        AggregatedDataFeedStore: ContractDataSchema,
        UpgradeableProxyADFS: ContractDataSchema,
        CLFeedRegistryAdapter: ContractDataSchema,
        AccessControl: ContractDataSchema,
        OnlySequencerGuard: S.UndefinedOr(ContractDataSchema),
        AdminExecutorModule: S.UndefinedOr(ContractDataSchema),
      }),
    ),
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

export const DeploymentConfigSchemaV2 = S.mutable(
  S.Struct({
    name: networkName,
    chainId: chainId,
    contracts: ContractsConfigSchemaV2,
  }),
);

export type DeploymentConfigV2 = typeof DeploymentConfigSchemaV2.Type;
