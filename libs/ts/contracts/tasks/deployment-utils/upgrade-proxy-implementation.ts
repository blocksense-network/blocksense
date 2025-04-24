import { ContractsConfigV2 } from '@blocksense/config-types/evm-contracts-deployment';
import { task } from 'hardhat/config';
import { ContractNames, NetworkConfig } from '../types';
import Safe from '@safe-global/protocol-kit';
import {
  OperationType,
  SafeTransactionDataPartial,
} from '@safe-global/safe-core-sdk-types';
import { ProxyOp } from '../../test/utils/wrappers/types';

task(
  'upgrade-proxy-implementation',
  '[UTILS] Upgrade upgradeable proxy implementation address',
).setAction(async (args, { ethers, artifacts, run }) => {
  const {
    deployData,
    config,
    safe,
  }: {
    deployData: ContractsConfigV2;
    config: NetworkConfig;
    safe: Safe;
  } = args;

  const signer = config.adminMultisig.signer || config.ledgerAccount!;

  const proxy = new ethers.Contract(
    deployData.coreContracts.UpgradeableProxyADFS.address,
    artifacts.readArtifactSync(ContractNames.UpgradeableProxyADFS).abi,
    signer,
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

  await run('multisig-tx-exec', {
    transactions: [safeTransactionData],
    safe,
    config,
  });
});
