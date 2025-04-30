import { task } from 'hardhat/config';

import Safe from '@safe-global/protocol-kit';

import { NetworkConfig, ContractNames, DeployContract } from './types';
import {
  isNetworkName,
  NetworkName,
  parseChainId,
  parseEthereumAddress,
} from '@blocksense/base-utils/evm';

import { getOptionalEnvString } from '@blocksense/base-utils/env';

import { DeploymentConfigV2 } from '@blocksense/config-types/evm-contracts-deployment';
import { predictAddress } from './utils';
import { readConfig, writeEvmDeployment } from '@blocksense/config-types';

task('deploy', 'Deploy contracts')
  .addParam('networks', 'Network to deploy to')
  .setAction(async (args, { ethers, artifacts, run }) => {
    const networks = args.networks.split(',');
    const configs: NetworkConfig[] = [];
    for (const network of networks) {
      if (!isNetworkName(network)) {
        throw new Error(`Invalid network: ${network}`);
      }
      configs.push(await run('init-chain', { networkName: network }));
    }

    const { feeds } = await readConfig('feeds_config_v2');
    const chainlinkCompatibility = await readConfig(
      'chainlink_compatibility_v2',
    );

    let dataFeedConfig = feeds.map(feed => {
      const compatibilityData =
        chainlinkCompatibility.blocksenseFeedsCompatibility[feed.id];
      const { base, quote } = compatibilityData?.chainlink_compatibility ?? {
        base: null,
        quote: null,
      };
      return {
        id: feed.id,
        description: feed.full_name,
        decimals: feed.additional_feed_info.decimals,
        base,
        quote,
      };
    });

    const chainsDeployment: Record<NetworkName, DeploymentConfigV2> = {} as any;

    const abiCoder = ethers.AbiCoder.defaultAbiCoder();

    for (const config of configs) {
      if (Array.isArray(config.feedIds)) {
        dataFeedConfig = dataFeedConfig.filter(
          feed => config.feedIds?.includes(feed.id) ?? false,
        );
      }

      const signer = config.adminMultisig.signer || config.ledgerAccount!;
      const chainId = parseChainId(config.network.chainId);
      console.log(`\n\n// ChainId: ${config.network.chainId}`);
      console.log(`// Signer: ${await signer.getAddress()}`);
      const signerBalance = await config.provider.getBalance(signer);
      console.log(`// balance: ${signerBalance} //`);

      const adminMultisig = await run('deploy-multisig', {
        config,
        type: 'adminMultisig',
      });
      const adminMultisigAddress = parseEthereumAddress(
        await adminMultisig.getAddress(),
      );

      const accessControlSalt = ethers.id('accessControl');
      const adfsSalt = ethers.id('aggregatedDataFeedStore');
      // env variable can be set to achieve an address that starts with '0xADF5'
      const proxySalt = getOptionalEnvString(
        'ADFS_UPGRADEABLE_PROXY_SALT',
        ethers.id('upgradeableProxy'),
      );
      const safeGuardSalt = ethers.id('onlySafeGuard');
      const safeModuleSalt = ethers.id('adminExecutorModule');

      const accessControlAddress = await predictAddress(
        artifacts,
        config,
        ContractNames.AccessControl,
        accessControlSalt,
        abiCoder.encode(['address'], [adminMultisigAddress]),
      );
      const upgradeableProxyAddress = await predictAddress(
        artifacts,
        config,
        ContractNames.UpgradeableProxyADFS,
        proxySalt,
        abiCoder.encode(['address'], [adminMultisigAddress]),
      );

      const contracts: DeployContract[] = [
        {
          name: ContractNames.AccessControl,
          argsTypes: ['address'],
          argsValues: [adminMultisigAddress],
          salt: accessControlSalt,
          value: 0n,
        },
        {
          name: ContractNames.ADFS,
          argsTypes: ['address'],
          argsValues: [accessControlAddress],
          salt: adfsSalt,
          value: 0n,
        },
        {
          name: ContractNames.UpgradeableProxyADFS,
          argsTypes: ['address'],
          argsValues: [adminMultisigAddress],
          salt: proxySalt,
          value: 0n,
        },
        {
          name: ContractNames.CLFeedRegistryAdapter,
          argsTypes: ['address', 'address'],
          argsValues: [adminMultisigAddress, upgradeableProxyAddress],
          salt: ethers.id('registry'),
          value: 0n,
        },
        ...dataFeedConfig.map(data => {
          return {
            name: ContractNames.CLAggregatorAdapter as const,
            argsTypes: ['string', 'uint8', 'uint32', 'address'],
            argsValues: [
              data.description,
              data.decimals,
              data.id,
              upgradeableProxyAddress,
            ],
            salt: ethers.id('aggregator'),
            value: 0n,
            feedRegistryInfo: {
              description: data.description,
              base: data.base,
              quote: data.quote,
            },
          };
        }),
      ];

      let sequencerMultisig: Safe | undefined;
      let sequencerMultisigAddress = parseEthereumAddress(ethers.ZeroAddress);

      if (config.deployWithSequencerMultisig) {
        sequencerMultisig = await run('deploy-multisig', {
          config,
          type: 'sequencerMultisig',
        });
        sequencerMultisigAddress = parseEthereumAddress(
          await sequencerMultisig!.getAddress(),
        );

        contracts.unshift({
          name: ContractNames.AdminExecutorModule,
          argsTypes: ['address', 'address'],
          argsValues: [sequencerMultisigAddress, adminMultisigAddress],
          salt: safeModuleSalt,
          value: 0n,
        });
        contracts.unshift({
          name: ContractNames.OnlySequencerGuard,
          argsTypes: ['address', 'address', 'address'],
          argsValues: [
            sequencerMultisigAddress,
            adminMultisigAddress,
            upgradeableProxyAddress,
          ],
          salt: safeGuardSalt,
          value: 0n,
        });
      }

      const deployData = await run('deploy-contracts', {
        config,
        adminMultisig,
        contracts,
      });

      deployData.coreContracts.OnlySequencerGuard ??= {
        address: parseEthereumAddress(ethers.ZeroAddress),
        constructorArgs: [],
      };

      chainsDeployment[networkName] = {
        name: networkName,
        chainId,
        contracts: {
          ...deployData,
          AdminMultisig: adminMultisigAddress,
          SequencerMultisig:
            sequencerMultisigAddress === ethers.ZeroAddress
              ? undefined
              : sequencerMultisigAddress,
        },
      };
      const signerBalancePost = await config.provider.getBalance(
        await signer.getAddress(),
      );
      console.log(`// balance: ${signerBalancePost} //`);
      console.log(`// balance diff: ${signerBalance - signerBalancePost} //`);

      await run('upgrade-proxy-implementation', {
        config,
        safe: adminMultisig,
        deployData,
      });

      await run('register-cl-adapters', {
        config,
        safe: adminMultisig,
        deployData,
      });

      await run('access-control', {
        config,
        deployData,
        adminMultisig,
        sequencerMultisig,
      });

      if (!config.deployWithSequencerMultisig) {
        chainsDeployment[
          networkName
        ].contracts.coreContracts.OnlySequencerGuard = undefined;
      }
    }

    await saveDeployment(configs, chainsDeployment);
  });

const saveDeployment = async (
  configs: NetworkConfig[],
  chainsDeployment: Record<NetworkName, DeploymentConfigV2>,
) => {
  for (const { networkName } of configs) {
    await writeEvmDeployment(networkName, chainsDeployment[networkName]);
  }
};
