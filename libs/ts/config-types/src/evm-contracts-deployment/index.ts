import { Schema as S } from 'effect';

import {
  chainId,
  ethereumAddress,
  networkName,
} from '@blocksense/base-utils/evm';
import { hexDataString } from '@blocksense/base-utils';

const ParameterType = S.Union(S.String, S.Number, S.BigIntFromSelf, S.Boolean);
const FunctionArgs = S.Array(ParameterType);

const feedId = S.BigInt.annotations({
  identifier: 'FeedId',
});

const ContractDataSchemaV1 = S.Struct({
  address: ethereumAddress,
  constructorArgs: FunctionArgs,
}).annotations({
  identifier: 'ContractDataV1',
});

const ContractDataSchemaV2 = S.Struct({
  ...ContractDataSchemaV1.fields,
  salt: hexDataString,
}).annotations({
  identifier: 'ContractDataV2',
});

export const CLAggregatorAdapterDataSchemaV1 = S.Struct({
  ...ContractDataSchemaV1.fields,
  description: S.String,
  base: S.NullOr(ethereumAddress),
  quote: S.NullOr(ethereumAddress),
}).annotations({
  identifier: 'CLAggregatorAdapterDataV1',
});

export const CLAggregatorAdapterDataSchemaV2 = S.Struct({
  ...ContractDataSchemaV2.fields,
  feedId: feedId,
  base: S.NullOr(ethereumAddress),
  quote: S.NullOr(ethereumAddress),
}).annotations({
  identifier: 'CLAggregatorAdapterDataV2',
});

export type CLAggregatorAdapterDataV2 =
  typeof CLAggregatorAdapterDataSchemaV2.Type;

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
        UpgradeableProxyADFS: ContractDataSchemaV2,
        AggregatedDataFeedStore: ContractDataSchemaV2,
        AccessControl: ContractDataSchemaV2,
        CLFeedRegistryAdapter: ContractDataSchemaV2,
      }),
    ),
    safe: S.mutable(
      S.Struct({
        AdminMultisig: ethereumAddress,
        ReporterMultisig: S.NullOr(ethereumAddress),
        OnlySequencerGuard: S.NullOr(ContractDataSchemaV2),
        AdminExecutorModule: S.NullOr(ContractDataSchemaV2),
      }),
    ),
    CLAggregatorAdapter: S.mutable(
      S.Record({
        // The key is the feedId, but effect schema does not support
        // `${bigint}` as a key type.
        key: S.String,
        value: CLAggregatorAdapterDataSchemaV2,
      }),
    ),
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
