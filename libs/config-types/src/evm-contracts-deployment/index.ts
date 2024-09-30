import * as S from '@effect/schema/Schema';

import {
  chainId,
  ethereumAddress,
  networkName,
  txHash,
} from '@blocksense/base-utils/evm-utils';

const ParameterType = S.Union(ethereumAddress, S.String, S.Number, S.Boolean);

const FunctionArgs = S.Array(ParameterType);

const ContractDataSchema = S.Struct({
  address: ethereumAddress,
  constructorArgs: FunctionArgs,
});

export type ContractData = S.Schema.Type<typeof ContractDataSchema>;

const ChainlinkProxyDataSchema = S.Struct({
  description: S.String,
  address: ethereumAddress,
  base: S.NullOr(ethereumAddress),
  quote: S.NullOr(ethereumAddress),
  constructorArgs: FunctionArgs,
});

export type ChainlinkProxyData = S.Schema.Type<typeof ChainlinkProxyDataSchema>;

const CoreContractsSchema = S.mutable(
  S.Struct({
    HistoricDataFeedStoreV2: ContractDataSchema,
    UpgradeableProxy: ContractDataSchema,
    FeedRegistry: ContractDataSchema,
  }),
);

export type CoreContracts = S.Schema.Type<typeof CoreContractsSchema>;

const ContractsConfigSchema = S.mutable(
  S.Struct({
    coreContracts: CoreContractsSchema,
    ChainlinkProxy: S.mutable(S.Array(ChainlinkProxyDataSchema)),
    SafeMultisig: ethereumAddress,
  }),
);

export type ContractsConfig = S.Schema.Type<typeof ContractsConfigSchema>;

export const DeploymentConfigSchema = S.mutable(
  S.Record({
    key: networkName,
    value: S.Struct({
      chainId: chainId,
      contracts: ContractsConfigSchema,
    }),
  }),
);

export type DeploymentConfig = S.Schema.Type<typeof DeploymentConfigSchema>;

export const decodeDeploymentConfig = S.decodeUnknownSync(
  DeploymentConfigSchema,
);
