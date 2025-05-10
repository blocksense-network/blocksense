import { task } from 'hardhat/config';

import { formatEther } from 'ethers/utils';

import Safe from '@safe-global/protocol-kit';

import { NetworkConfig, ContractNames, DeployContract } from './types';
import {
  isNetworkName,
  NetworkName,
  parseChainId,
  parseEthereumAddress,
} from '@blocksense/base-utils/evm';

import { getOptionalEnvString } from '@blocksense/base-utils/env';
import { padNumber } from '@blocksense/base-utils/string';

import { DeploymentConfigV2 } from '@blocksense/config-types/evm-contracts-deployment';
import { predictAddress } from './utils';
import { readConfig, writeEvmDeployment } from '@blocksense/config-types';
import { initChain } from './deployment-utils/init-chain';

task('deploy', 'Deploy contracts')
  .addParam('networks', 'Network to deploy to')
  .setAction(async (args, { ethers, artifacts, run }) => {
    const networks = args.networks.split(',');
    const configs: NetworkConfig[] = [];
    for (const network of networks) {
      if (!isNetworkName(network)) {
        throw new Error(`Invalid network: ${network}`);
      }
      configs.push(await initChain(ethers, network));
    }

    const { feeds } = await readConfig('feeds_config_v2');
    const chainlinkCompatibility = await readConfig(
      'chainlink_compatibility_v2',
    );

    const getCLRegistryPair = (feedId: bigint) => {
      const { base, quote } =
        chainlinkCompatibility.blocksenseFeedsCompatibility[feedId.toString()]
          .chainlink_compatibility;
      return { base, quote };
    };

    const chainsDeployment = {} as Record<NetworkName, DeploymentConfigV2>;

    const abiCoder = ethers.AbiCoder.defaultAbiCoder();

    for (const config of configs) {
      const feedsToDeploy = config.feedIds;
      const dataFeedConfig =
        feedsToDeploy !== 'all'
          ? feeds.filter(feed => feedsToDeploy.includes(feed.id) ?? false)
          : feeds;

      const signer = config.adminMultisig.signer ?? config.ledgerAccount!;
      const chainId = parseChainId(config.network.chainId);
      const { networkName } = config;

      console.log(`Blocksense EVM contracts deployment`);
      console.log(`===================================\n`);

      const signerBalance = await config.provider.getBalance(signer);

      const create2ContractSalts = {
        accessControl: ethers.id('accessControl'),
        adfs: ethers.id('aggregatedDataFeedStore'),
        proxy: config.adfsUpgradeableProxySalt,
        safeGuard: ethers.id('onlySafeGuard'),
        safeModule: ethers.id('adminExecutorModule'),
        clFeedRegistry: ethers.id('registry'),
        clAggregatorProxy: ethers.id('aggregator'),
      };

      console.log(`// RPC: ${config.rpc}`);
      console.log(`// Network: ${config.networkName} (chainId: ${chainId})`);
      console.log(`// Signer: ${await signer.getAddress()}`);
      console.log(`// Balance: ${fmtEth(signerBalance)}`);
      console.log(`// `);
      console.log(`// Admin MultiSig:`);
      console.log(`//   threshold: ${config.adminMultisig.threshold}`);
      console.log(`//      owners: ${config.adminMultisig.owners}`);
      console.log(`// `);
      console.log(
        `// Reporter MultiSig: ${config.deployWithSequencerMultisig ? '✅' : '❌'}`,
      );
      console.log(`//   threshold: ${config.sequencerMultisig.threshold}`);
      console.log(`//      owners: ${config.sequencerMultisig.owners}`);
      console.log(`// `);
      console.log(`// Feeds: `);
      for (const feed of dataFeedConfig) {
        console.log(
          `//   | ${padNumber(feed.id, 7)}` +
            `| ${feed.full_name.padStart(15)} ` +
            `| decimals: ${padNumber(feed.additional_feed_info.decimals, 2)} |`,
        );
      }
      console.log(`// `);
      console.log(`// Create2 salts:`);
      for (const [name, salt] of Object.entries(create2ContractSalts)) {
        console.log(`//   | ${name.padStart(17)}| ${salt}`);
      }

      const adminMultisig = await run('deploy-multisig', {
        config,
        type: 'adminMultisig',
      });
      const adminMultisigAddress = parseEthereumAddress(
        await adminMultisig.getAddress(),
      );

      // const accessControlSalt = ethers.id('accessControl');
      // const adfsSalt = ethers.id('aggregatedDataFeedStore');
      // // env variable can be set to achieve an address that starts with '0xADF5'
      // const proxySalt = getOptionalEnvString(
      //   'ADFS_UPGRADEABLE_PROXY_SALT',
      //   ethers.id('upgradeableProxy'),
      // );
      // const safeGuardSalt = ethers.id('onlySafeGuard');
      // const safeModuleSalt = ethers.id('adminExecutorModule');

      const accessControlAddress = await predictAddress(
        artifacts,
        config,
        ContractNames.AccessControl,
        create2ContractSalts.accessControl,
        abiCoder.encode(['address'], [adminMultisigAddress]),
      );
      const upgradeableProxyAddress = await predictAddress(
        artifacts,
        config,
        ContractNames.UpgradeableProxyADFS,
        create2ContractSalts.proxy,
        abiCoder.encode(['address'], [adminMultisigAddress]),
      );

      const contracts: DeployContract[] = [
        {
          name: ContractNames.AccessControl,
          argsTypes: ['address'],
          argsValues: [adminMultisigAddress],
          salt: create2ContractSalts.accessControl,
          value: 0n,
        },
        {
          name: ContractNames.ADFS,
          argsTypes: ['address'],
          argsValues: [accessControlAddress],
          salt: create2ContractSalts.adfs,
          value: 0n,
        },
        {
          name: ContractNames.UpgradeableProxyADFS,
          argsTypes: ['address'],
          argsValues: [adminMultisigAddress],
          salt: create2ContractSalts.proxy,
          value: 0n,
        },
        {
          name: ContractNames.CLFeedRegistryAdapter,
          argsTypes: ['address', 'address'],
          argsValues: [adminMultisigAddress, upgradeableProxyAddress],
          salt: create2ContractSalts.clFeedRegistry,
          value: 0n,
        },
        ...dataFeedConfig.map(data => {
          const { base, quote } = getCLRegistryPair(data.id);
          return {
            name: ContractNames.CLAggregatorAdapter as const,
            argsTypes: ['string', 'uint8', 'uint256', 'address'],
            argsValues: [
              data.description,
              data.additional_feed_info.decimals,
              data.id,
              upgradeableProxyAddress,
            ],
            salt: create2ContractSalts.clAggregatorProxy,
            value: 0n,
            feedRegistryInfo: {
              feedId: data.id,
              description: `${data.full_name} (${data.id})`,
              base,
              quote,
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
          salt: create2ContractSalts.safeModule,
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
          salt: create2ContractSalts.safeGuard,
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

      console.log(`// balance: ${fmtEth(signerBalancePost)}`);
      console.log(`//    diff: ${fmtEth(signerBalance - signerBalancePost)}`);

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

function fmtEth(balance: bigint) {
  return `${formatEther(balance)} ETH (${balance} wei)`;
}

const saveDeployment = async (
  configs: NetworkConfig[],
  chainsDeployment: Record<NetworkName, DeploymentConfigV2>,
) => {
  for (const { networkName } of configs) {
    await writeEvmDeployment(networkName, chainsDeployment[networkName]);
  }
};
