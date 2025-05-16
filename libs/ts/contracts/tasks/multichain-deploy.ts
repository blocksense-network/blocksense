import { createInterface } from 'node:readline/promises';

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

import { padNumber } from '@blocksense/base-utils/string';

import { DeploymentConfigV2 } from '@blocksense/config-types/evm-contracts-deployment';
import { predictAddress } from './utils';
import { readConfig, writeEvmDeployment } from '@blocksense/config-types';
import { initChain } from './deployment-utils/init-chain';
import { deployContracts } from './deployment-utils/deploy-contracts';
import { setUpAccessControl } from './deployment-utils/access-control';
import { HexDataString, parseHexDataString } from '@blocksense/base-utils';

const readline = createInterface({
  input: process.stdin,
  output: process.stdout,
});

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

      const chainId = parseChainId(config.network.chainId);
      const { networkName } = config;

      console.log(`Blocksense EVM contracts deployment`);
      console.log(`===================================\n`);

      const signerBalance = await config.provider.getBalance(
        config.deployerAddress,
      );

      const keccak256 = (str: string) => parseHexDataString(ethers.id(str));

      const create2ContractSalts = {
        upgradeableProxy: config.adfsUpgradeableProxySalt,
        accessControl: keccak256('accessControl'),
        adfs: keccak256('aggregatedDataFeedStore'),
        safeGuard: keccak256('onlySafeGuard'),
        safeModule: keccak256('adminExecutorModule'),
        clFeedRegistry: keccak256('registry'),
        clAggregatorProxy: keccak256('aggregator'),
      } satisfies Record<string, HexDataString>;

      console.log(`// RPC: ${config.rpc}`);
      console.log(`// Network: ${config.networkName} (chainId: ${chainId})`);
      console.log(`// Deployer: ${config.deployerAddress}`);
      console.log(`// Balance: ${fmtEth(signerBalance)}`);
      console.log(`// `);
      console.log(`// Admin MultiSig:`);
      console.log(`//   threshold: ${config.adminMultisig.threshold}`);
      console.log(`//      owners: ${config.adminMultisig.owners}`);
      console.log(`// `);
      console.log(
        `// Reporter MultiSig: ${config.deployWithReporterMultisig ? '✅' : '❌'}`,
      );
      console.log(`//   threshold: ${config.reporterMultisig.threshold}`);
      console.log(`//      owners: ${config.reporterMultisig.owners}`);
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
      console.log(`// CREATE2 salts:`);
      for (const [name, salt] of Object.entries(create2ContractSalts)) {
        console.log(`//   | ${name.padStart(17)}| ${salt}`);
      }
      console.log('\n');

      if ((await readline.question('Confirm deployment? (y/n)')) !== 'y') {
        console.log('Aborting deployment...');
        return;
      }

      const adminMultisig = await run('deploy-multisig', {
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
          const { base, quote } = getCLRegistryPair(data.id);
          return {
            name: ContractNames.CLAggregatorAdapter as const,
            argsTypes: ['string', 'uint8', 'uint256', 'address'],
            argsValues: [
              data.full_name,
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

      let reporterMultisig: Safe | undefined;
      let reporterMultisigAddress = parseEthereumAddress(ethers.ZeroAddress);

      if (config.deployWithReporterMultisig) {
        reporterMultisig = await run('deploy-multisig', {
          config,
          type: 'reporterMultisig',
        });
        reporterMultisigAddress = parseEthereumAddress(
          await reporterMultisig!.getAddress(),
        );

        contracts.unshift({
          name: ContractNames.AdminExecutorModule,
          argsTypes: ['address', 'address'],
          argsValues: [reporterMultisigAddress, adminMultisigAddress],
          salt: parseHexDataString(create2ContractSalts.safeModule),
          value: 0n,
        });
        contracts.unshift({
          name: ContractNames.OnlySequencerGuard,
          argsTypes: ['address', 'address', 'address'],
          argsValues: [
            reporterMultisigAddress,
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
        run,
        artifacts,
      });

      chainsDeployment[networkName] = {
        network: networkName,
        chainId,
        contracts: {
          ...deployData,
          AdminMultisig: adminMultisigAddress,
          ReporterMultisig:
            reporterMultisigAddress === ethers.ZeroAddress
              ? null
              : reporterMultisigAddress,
        },
      };
      const signerBalancePost = await config.provider.getBalance(
        config.deployerAddress,
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

      await setUpAccessControl({
        run,
        artifacts,
        config,
        deployData,
        adminMultisig,
        reporterMultisig,
      });

      if (!config.deployWithReporterMultisig) {
        chainsDeployment[
          networkName
        ].contracts.coreContracts.OnlySequencerGuard = null;
        chainsDeployment[
          networkName
        ].contracts.coreContracts.AdminExecutorModule = null;
      }
    }

    await saveDeployment(configs, chainsDeployment);
  });

function fmtEth(balance: bigint) {
  return `${formatEther(balance)} ETH (${balance} wei)`;
}

async function saveDeployment(
  configs: NetworkConfig[],
  chainsDeployment: Record<NetworkName, DeploymentConfigV2>,
) {
  for (const { networkName } of configs) {
    await writeEvmDeployment(networkName, chainsDeployment[networkName]);
  }
}
