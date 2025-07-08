import { Schema as S } from 'effect';

import {
  chainId,
  ethereumAddress,
  networkName,
} from '@blocksense/base-utils/evm';

const ParameterType = S.Union(S.String, S.Number, S.BigIntFromSelf, S.Boolean);
const FunctionArgs = S.Array(ParameterType);

const ContractDataSchemaV1 = S.Struct({
  address: ethereumAddress,
  constructorArgs: FunctionArgs,
});

export const CLAggregatorAdapterDataSchemaV1 = S.Struct({
  ...ContractDataSchemaV1.fields,
  description: S.String,
  base: S.NullOr(ethereumAddress),
  quote: S.NullOr(ethereumAddress),
}).annotations({
  identifier: 'CLAggregatorAdapterDataV1',
});

export type CLAggregatorAdapterDataV1 =
  typeof CLAggregatorAdapterDataSchemaV1.Type;

const ContractsConfigSchemaV1 = S.mutable(
  S.Struct({
    coreContracts: S.mutable(
      S.Struct({
        HistoricalDataFeedStoreV2: ContractDataSchemaV1,
        UpgradeableProxy: ContractDataSchemaV1,
        CLFeedRegistryAdapter: ContractDataSchemaV1,
      }),
    ),
    CLAggregatorAdapter: S.mutable(S.Array(CLAggregatorAdapterDataSchemaV1)),
    SafeMultisig: ethereumAddress,
  }),
).annotations({ identifier: 'ContractsConfigV1' });

const ContractsConfigSchemaV2 = S.mutable(
  S.Struct({
    coreContracts: S.mutable(
      S.Struct({
        AggregatedDataFeedStore: ContractDataSchemaV1,
        UpgradeableProxyADFS: ContractDataSchemaV1,
        CLFeedRegistryAdapter: ContractDataSchemaV1,
        AccessControl: ContractDataSchemaV1,
        OnlySequencerGuard: S.UndefinedOr(ContractDataSchemaV1),
        AdminExecutorModule: S.UndefinedOr(ContractDataSchemaV1),
      }),
    ),
    CLAggregatorAdapter: S.mutable(S.Array(CLAggregatorAdapterDataSchemaV1)),
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
    name: networkName,
    chainId: chainId,
    contracts: ContractsConfigSchemaV2,
  }),
).annotations({
  identifier: 'DeploymentConfigV2',
});

export type DeploymentConfigV2 = typeof DeploymentConfigSchemaV2.Type;
