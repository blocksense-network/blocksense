import { readFile, writeFile } from 'node:fs/promises';
import * as prettier from 'prettier';

import { AbiCoder, formatEther, id, ZeroAddress } from 'ethers';
import { task } from 'hardhat/config';

import type Safe from '@safe-global/protocol-kit';

import {
  HexDataString,
  parseHexDataString,
} from '@blocksense/base-utils/buffer-and-hex';
import {
  isNetworkName,
  NetworkName,
  parseChainId,
  parseEthereumAddress,
} from '@blocksense/base-utils/evm';
import { padNumber } from '@blocksense/base-utils/string';
import { readline } from '@blocksense/base-utils/tty';

import { DeploymentConfigV2 } from '@blocksense/config-types/evm-contracts-deployment';
import {
  readConfig,
  writeEvmDeployment,
} from '@blocksense/config-types/read-write-config';

import { NetworkConfig, ContractNames, DeployContract } from './types';
import { predictAddress } from './utils';
import { initChain } from './deployment-utils/init-chain';
import { setUpAccessControl } from './deployment-utils/access-control';
import { deployContracts } from './deployment-utils/deploy-contracts';
import {
  deployMultisig,
  predictMultisigAddress,
} from './deployment-utils/deploy-multisig';
import { registerCLAdapters } from './deployment-utils/register-cl-adapters';
import { upgradeProxyImplementation } from './deployment-utils/upgrade-proxy-implementation';
import { mineVanityAddress } from './mine-vanity-address';

task('deploy', 'Deploy contracts')
  .addParam('networks', 'Network to deploy to')
  .setAction(async (args, { artifacts }) => {
    const networks = args.networks.split(',');
    const configs: NetworkConfig[] = [];
    for (const network of networks) {
      if (!isNetworkName(network)) {
        throw new Error(`Invalid network: ${network}`);
      }
      configs.push(await initChain(network));
    }

    const { feeds } = await readConfig('feeds_config_v2');
    const chainlinkCompatibility = await readConfig(
      'chainlink_compatibility_v2',
    );

    const getCLRegistryPair = (feedId: bigint) => {
      const { base, quote } = chainlinkCompatibility
        .blocksenseFeedsCompatibility[feedId.toString()]
        ?.chainlink_compatibility ?? {
        base: null,
        quote: null,
      };
      return { base, quote };
    };

    const chainsDeployment = {} as Record<NetworkName, DeploymentConfigV2>;

    const abiCoder = AbiCoder.defaultAbiCoder();

    for (const config of configs) {
      const feedsToDeploy = config.feedIds;
      const dataFeedConfig =
        feedsToDeploy !== 'all'
          ? feeds.filter(feed => feedsToDeploy.includes(feed.id) ?? false)
          : feeds;

      const chainId = parseChainId(config.network.chainId);
      const { networkName } = config;

      const signerBalance = await config.provider.getBalance(
        config.deployerAddress,
      );

      const keccak256 = (str: string) => parseHexDataString(id(str));

      const { safeAddress: adminMultisigAddress } =
        await predictMultisigAddress({
          config,
          type: 'adminMultisig',
        });

      let upgradeableProxySalt = config.adfsUpgradeableProxySalt;
      if (upgradeableProxySalt === id('upgradeableProxy')) {
        while (true) {
          const res = await mineVanityAddress({
            config,
            adminMultisigAddr: adminMultisigAddress,
            artifacts,
            prefix: 'ADF5aa',
            maxRetries: 200,
          });

          if (
            res &&
            (await readline().question(
              `\nConfirm ${res?.address} address for UpgradeableProxy with salt ${res?.salt}? (y/n) `,
            )) === 'y'
          ) {
            upgradeableProxySalt = parseHexDataString(res!.salt);
            break;
          }
        }
      }

      const create2ContractSalts = {
        upgradeableProxy: upgradeableProxySalt,
        accessControl: keccak256('accessControl'),
        adfs: keccak256('aggregatedDataFeedStore'),
        safeGuard: keccak256('onlySafeGuard'),
        safeModule: keccak256('adminExecutorModule'),
        clFeedRegistry: keccak256('registry'),
        clAggregatorProxy: keccak256('aggregator'),
      } satisfies Record<string, HexDataString>;

      console.log(`Blocksense EVM contracts deployment`);
      console.log(`===================================\n`);
      console.log(`// RPC: ${config.rpc}`);
      console.log(`// Network: ${networkName} (chainId: ${chainId})`);
      console.log(`// Deployer: ${config.deployerAddress}`);
      console.log(`// Balance: ${fmtEth(signerBalance)}`);
      console.log(`// `);
      console.log(
        `// Admin MultiSig: ${config.adminMultisig.threshold > 0 ? '✅' : '❌'}`,
      );
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
          } satisfies DeployContract;
        }),
      ];

      let reporterMultisig: Safe | undefined;
      let reporterMultisigAddress = parseEthereumAddress(ZeroAddress);

      if (config.deployWithReporterMultisig) {
        reporterMultisig = await deployMultisig({
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
        artifacts,
      });

      chainsDeployment[networkName] = {
        network: networkName,
        chainId,
        contracts: {
          ...deployData,
          safe: {
            AdminMultisig: adminMultisigAddress,
            ReporterMultisig:
              reporterMultisigAddress === ZeroAddress
                ? null
                : reporterMultisigAddress,
            AdminExecutorModule: deployData.safe.AdminExecutorModule,
            OnlySequencerGuard: deployData.safe.OnlySequencerGuard,
          },
        },
      };
      const signerBalancePost = await config.provider.getBalance(
        config.deployerAddress,
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
        reporterMultisig,
      });

      if (!config.deployWithReporterMultisig) {
        chainsDeployment[networkName].contracts.safe.AdminExecutorModule = null;
        chainsDeployment[networkName].contracts.safe.OnlySequencerGuard = null;
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
    const filePath = await writeEvmDeployment(
      networkName,
      chainsDeployment[networkName],
    );

    const source = await readFile(filePath, 'utf8');
    const options = await prettier.resolveConfig(filePath);
    const formatted = await prettier.format(source, {
      ...options,
      parser: 'json',
      filepath: filePath,
    });
    await writeFile(filePath, formatted, 'utf8');
  }
}
