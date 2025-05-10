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
  feedId: S.BigInt, // bigint encoded as string in JSON
  base: S.NullOr(ethereumAddress),
  quote: S.NullOr(ethereumAddress),
}).annotations({
  identifier: 'CLAggregatorAdapterData',
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
).annotations({ identifier: 'ContractsConfigV1' });

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
    CLAggregatorAdapter: S.mutable(
      S.Record({
        key: S.String,
        value: CLAggregatorAdapterDataSchema,
      }),
    ),
    SequencerMultisig: ethereumAddress,
    AdminMultisig: ethereumAddress,
  }),
).annotations({ identifier: 'ContractsConfigV2' });

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
).annotations({
  identifier: 'DeploymentConfigV1',
});

export const DeploymentConfigSchemaV2 = S.mutable(
  S.Struct({
    network: networkName,
    chainId: chainId,
    contracts: ContractsConfigSchemaV2,
  }),
).annotations({
  identifier: 'DeploymentConfigV2',
});

export type DeploymentConfigV2 = typeof DeploymentConfigSchemaV2.Type;
