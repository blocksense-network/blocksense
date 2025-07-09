import { formatEther } from 'ethers';
import { task } from 'hardhat/config';

import type Safe from '@safe-global/protocol-kit';

import { getOptionalEnvString } from '@blocksense/base-utils/env';
import {
  isNetworkName,
  NetworkName,
  parseChainId,
  parseEthereumAddress,
} from '@blocksense/base-utils/evm';
import { padNumber } from '@blocksense/base-utils/string';
import { readline } from '@blocksense/base-utils/tty';

import { DeploymentConfigV2 } from '@blocksense/config-types/evm-contracts-deployment';
import { readConfig, writeEvmDeployment } from '@blocksense/config-types';

import { NetworkConfig, ContractNames, DeployContract } from './types';
import { predictAddress } from './utils';
import { initChain } from './deployment-utils/init-chain';
import { setUpAccessControl } from './deployment-utils/access-control';
import { deployContracts } from './deployment-utils/deploy-contracts';
import { deployMultisig } from './deployment-utils/deploy-multisig';
import { registerCLAdapters } from './deployment-utils/register-cl-adapters';
import { upgradeProxyImplementation } from './deployment-utils/upgrade-proxy-implementation';

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

    const getCLRegistryPair = (feedId: number | bigint) => {
      const { base, quote } = chainlinkCompatibility
        .blocksenseFeedsCompatibility[feedId.toString()]
        ?.chainlink_compatibility ?? {
        base: null,
        quote: null,
      };
      return { base, quote };
    };

    const chainsDeployment: Record<NetworkName, DeploymentConfigV2> = {} as any;

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

      const signerBalance = await config.provider.getBalance(signer);

      const create2ContractSalts = {
        upgradeableProxy: getOptionalEnvString(
          'ADFS_UPGRADEABLE_PROXY_SALT',
          ethers.id('upgradeableProxy'),
        ),
        accessControl: ethers.id('accessControl'),
        adfs: ethers.id('aggregatedDataFeedStore'),
        safeGuard: ethers.id('onlySafeGuard'),
        safeModule: ethers.id('adminExecutorModule'),
        clFeedRegistry: ethers.id('registry'),
        clAggregatorProxy: ethers.id('aggregator'),
      };

      console.log(`Blocksense EVM contracts deployment`);
      console.log(`===================================\n`);
      console.log(`// RPC: ${config.rpc}`);
      console.log(`// Network: ${networkName} (chainId: ${chainId})`);
      console.log(`// Signer: ${await signer.getAddress()}`);
      console.log(`// Balance: ${fmtEth(signerBalance)}`);
      console.log(`// `);
      console.log(
        `// Admin MultiSig: ${config.adminMultisig.threshold > 0 ? '✅' : '❌'}`,
      );
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

      const printFeed = (feedIdx: number) => {
        const feed = dataFeedConfig[feedIdx];
        console.log(
          `//   | ${padNumber(feed.id, 7)}` +
            `| ${feed.full_name.padStart(15)} ` +
            `| decimals: ${padNumber(feed.additional_feed_info.decimals, 2)} |`,
        );
      };

      if (dataFeedConfig.length > 20) {
        console.log(`//    ${dataFeedConfig.length} feeds`);
        // print first and last feed
        printFeed(0);
        console.log(`//   ...`);
        printFeed(dataFeedConfig.length - 1);
      } else {
        for (let i = 0; i < dataFeedConfig.length; i++) {
          printFeed(i);
        }
      }
      console.log(`// `);
      console.log(`// CREATE2 salts:`);
      for (const [name, salt] of Object.entries(create2ContractSalts)) {
        console.log(`//   | ${name.padStart(17)}| ${salt}`);
      }

      if ((await readline().question('\nConfirm deployment? (y/n) ')) !== 'y') {
        console.log('Aborting deployment...');
        return;
      }

      console.log('---------------------------\n');

      const adminMultisig = await deployMultisig({
        config,
        type: 'adminMultisig',
      });
      const adminMultisigAddress = parseEthereumAddress(
        await adminMultisig.getAddress(),
      );

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
        create2ContractSalts.upgradeableProxy,
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
          salt: create2ContractSalts.upgradeableProxy,
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
          return {
            name: ContractNames.CLAggregatorAdapter as const,
            argsTypes: ['string', 'uint8', 'uint32', 'address'],
            argsValues: [
              data.description,
              data.additional_feed_info.decimals,
              data.id,
              upgradeableProxyAddress,
            ],
            salt: create2ContractSalts.clAggregatorProxy,
            value: 0n,
            feedRegistryInfo: {
              description: `${data.full_name} (${data.id})`,
              base: data.base,
              quote: data.quote,
            },
          };
        }),
      ];

      let sequencerMultisig: Safe | undefined;
      let sequencerMultisigAddress = parseEthereumAddress(ethers.ZeroAddress);

      if (config.deployWithSequencerMultisig) {
        sequencerMultisig = await deployMultisig({
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

      const deployData = await deployContracts({
        config,
        adminMultisig,
        contracts,
        artifacts,
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

      await upgradeProxyImplementation({
        config,
        safe: adminMultisig,
        deployData,
        artifacts,
      });

      await registerCLAdapters({
        config,
        safe: adminMultisig,
        deployData,
        artifacts,
      });

      await setUpAccessControl({
        artifacts,
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
