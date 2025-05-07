import { Contract } from 'ethers';
import { Artifacts } from 'hardhat/types';
import Safe from '@safe-global/protocol-kit';
import {
  OperationType,
  SafeTransactionDataPartial,
} from '@safe-global/safe-core-sdk-types';

import { ContractsConfigV2 } from '@blocksense/config-types/evm-contracts-deployment';

import { ContractNames, NetworkConfig } from '../types';
import { ProxyOp } from '../../test/utils/wrappers/types';
import { executeMultisigTransaction } from './multisig-tx-exec';

type Params = {
  deployData: ContractsConfigV2;
  config: NetworkConfig;
  safe: Safe;
  artifacts: Artifacts;
};

export async function upgradeProxyImplementation({
  deployData,
  config,
  safe,
  artifacts,
}: Params) {
  const proxy = new Contract(
    deployData.coreContracts.UpgradeableProxyADFS.address,
    artifacts.readArtifactSync(ContractNames.UpgradeableProxyADFS).abi,
    config.deployer,
  );

  // if new implementation needs initialization data, change the line below
  const calldata = '0x';

  const safeTransactionData: SafeTransactionDataPartial = {
    to: proxy.target.toString(),
    value: '0',
    data: ProxyOp.UpgradeTo.concat(
      deployData.coreContracts.AggregatedDataFeedStore.address.slice(2),
    ).concat(calldata.slice(2)),
    operation: OperationType.Call,
  };

  console.log(
    `Upgrading proxy implementation to ${deployData.coreContracts.AggregatedDataFeedStore.address}`,
  );

  await executeMultisigTransaction({
    transactions: [safeTransactionData],
    safe,
    config,
  });
}
