import * as S from '@effect/schema/Schema';

import { ethereumAddress, networkName } from '@blocksense/base-utils/evm';

// Schema for Chainlink Proxy entries
const ChainlinkProxySchema = S.Struct({
  description: S.String,
  address: ethereumAddress,
  base: S.NullishOr(ethereumAddress),
  quote: S.NullishOr(ethereumAddress),
  chainlink_proxy: S.NullishOr(ethereumAddress),
});

// Schema for Core Contracts
const CoreContractsSchema = S.Struct({
  HistoricDataFeedStoreV2: ethereumAddress,
  UpgradeableProxy: ethereumAddress,
  FeedRegistry: ethereumAddress,
});

// Schema for Contracts which include Core Contracts and Chainlink Proxy array
const ContractsSchema = S.Struct({
  coreContracts: CoreContractsSchema,
  ChainlinkProxy: S.Array(ChainlinkProxySchema),
  SafeMultisig: ethereumAddress,
});

// Schema for each network object containing name and contracts
const NetworkSchema = S.Struct({
  name: networkName,
  contracts: ContractsSchema,
});

// Define the schema for the main JSON structure
const SupportedNetworksSchema = S.Record({
  key: S.String,
  value: NetworkSchema,
});

// Type inference for the Main JSON structure
export type SupportedNetworks = S.Schema.Type<typeof SupportedNetworksSchema>;

// Create a decoder for the Main JSON structure
export const decodeSupportedNetworks = S.decodeUnknownSync(
  SupportedNetworksSchema,
);
