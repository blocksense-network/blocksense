import { task } from 'hardhat/config';
import { Artifacts } from 'hardhat/types';
import { Wallet, ethers } from 'ethers';

import Safe, {
  SafeAccountConfig,
  SafeFactory,
} from '@safe-global/protocol-kit';
import {
  OperationType,
  SafeTransaction,
  SafeTransactionDataPartial,
} from '@safe-global/safe-core-sdk-types';
import { getCreateCallDeployment } from '@safe-global/safe-deployments';

import {
  NetworkConfig,
  ContractNames,
  MultisigConfig,
  DeployContract,
} from './types';
import {
  EthereumAddress,
  getNetworkNameByChainId,
  getRpcUrl,
  isNetworkName,
  NetworkName,
  parseChainId,
  parseEthereumAddress,
  parseTxHash,
} from '@blocksense/base-utils/evm';

import {
  getEnvString,
  configDir,
  getOptionalEnvString,
} from '@blocksense/base-utils/env';
import { selectDirectory } from '@blocksense/base-utils/fs';
import { kebabToSnakeCase } from '@blocksense/base-utils/string';

import { ChainlinkCompatibilityConfigSchema } from '@blocksense/config-types/chainlink-compatibility';
import {
  FeedsConfigSchema,
  NewFeedsConfigSchema,
} from '@blocksense/config-types/data-feeds-config';
import {
  CLAggregatorAdapterData,
  ContractsConfigV2,
  CoreContractsV2,
  DeploymentConfigV2,
  DeploymentConfigSchemaV2,
} from '@blocksense/config-types/evm-contracts-deployment';

task('deploy', 'Deploy contracts')
  .addParam('networks', 'Network to deploy to')
  .setAction(async (args, { ethers, artifacts }) => {
    const networks = args.networks.split(',');
    const configs: NetworkConfig[] = [];
    for (const network of networks) {
      if (!isNetworkName(network)) {
        throw new Error(`Invalid network: ${network}`);
      }
      configs.push(await initChain(network));
    }

    const { decodeJSON } = selectDirectory(configDir);
    const { feeds } = await decodeJSON(
      { name: 'feeds_config_new' },
      NewFeedsConfigSchema,
    );
    const chainlinkCompatibility = await decodeJSON(
      { name: 'chainlink_compatibility_new' },
      ChainlinkCompatibilityConfigSchema,
    );

    const dataFeedConfig = feeds.map(feed => {
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

    const chainsDeployment: DeploymentConfigV2 = {} as DeploymentConfigV2;

    const abiCoder = ethers.AbiCoder.defaultAbiCoder();

    for (const config of configs) {
      const chainId = parseChainId(config.network.chainId);
      console.log(`\n\n// ChainId: ${config.network.chainId}`);
      console.log(`// Signer: ${config.adminMultisig.signer.address}`);
      const signerBalance = await config.provider.getBalance(
        config.adminMultisig.signer,
      );
      console.log(`// balance: ${signerBalance} //`);

      const adminMultisig = await deployMultisig(config, 'adminMultisig');
      const adminMultisigAddress = parseEthereumAddress(
        await adminMultisig.getAddress(),
      );

      const accessControlSalt = ethers.id('accessControl');
      const adfsSalt = ethers.id('aggregatedDataFeedStore');
      // this address starts with '0xADF5...' for local deployment
      // should be recalculated when admin address and/or owners (therefore adminMultisig address) changes
      const proxySalt =
        '0x209fdf6800d7d02ac1cc47ea0409e3064b940123694168d0c33238324bb086e1';
      const safeGuardSalt = ethers.id('onlySafeGuard');

      const accessControlAddress = await predictAddress(
        artifacts,
        config,
        ContractNames.AccessControl,
        accessControlSalt,
        abiCoder.encode(['address'], [adminMultisigAddress]),
      );
      const adfsAddress = await predictAddress(
        artifacts,
        config,
        ContractNames.ADFS,
        adfsSalt,
        abiCoder.encode(['address'], [accessControlAddress]),
      );
      const upgradeableProxyAddress = await predictAddress(
        artifacts,
        config,
        ContractNames.UpgradeableProxyADFS,
        proxySalt,
        abiCoder.encode(
          ['address', 'address'],
          [adfsAddress, adminMultisigAddress],
        ),
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
          argsTypes: ['address', 'address'],
          argsValues: [adfsAddress, adminMultisigAddress],
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
        sequencerMultisig = await deployMultisig(config, 'sequencerMultisig');
        sequencerMultisigAddress = parseEthereumAddress(
          await sequencerMultisig.getAddress(),
        );

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

      const deployData = await deployContracts(
        config,
        adminMultisig,
        artifacts,
        contracts,
      );

      const networkName = getNetworkNameByChainId(chainId);
      deployData.coreContracts.OnlySequencerGuard ??= {
        address: parseEthereumAddress(ethers.ZeroAddress),
        constructorArgs: [],
      };
      chainsDeployment[networkName] = {
        chainId,
        contracts: {
          ...deployData,
          AdminMultisig: adminMultisigAddress,
          SequencerMultisig: sequencerMultisigAddress,
        },
      };
      const signerBalancePost = await config.provider.getBalance(
        config.adminMultisig.signer,
      );
      console.log(`// balance: ${signerBalancePost} //`);
      console.log(`// balance diff: ${signerBalance - signerBalancePost} //`);

      await registerCLAggregatorAdapters(
        config,
        adminMultisig,
        deployData,
        artifacts,
      );

      await setupAccessControl(
        config,
        deployData,
        artifacts,
        adminMultisig,
        sequencerMultisig,
      );

      if (!config.deployWithSequencerMultisig) {
        chainsDeployment[
          networkName
        ].contracts.coreContracts.OnlySequencerGuard = {
          address: parseEthereumAddress(ethers.ZeroAddress),
          constructorArgs: [],
        };
      }
    }

    await saveDeployment(configs, chainsDeployment);
  });

const deployMultisig = async (
  config: NetworkConfig,
  type: keyof Pick<NetworkConfig, 'adminMultisig' | 'sequencerMultisig'>,
) => {
  const safeVersion = '1.4.1';

  // Create SafeFactory instance
  const safeFactory = await SafeFactory.init({
    provider: config.rpc,
    signer: config[type].signer.privateKey,
    safeVersion,
    contractNetworks: {
      [config.network.chainId.toString()]: config.safeAddresses,
    },
  });

  console.log('\nSafeFactory address:', await safeFactory.getAddress());

  const safeAccountConfig: SafeAccountConfig = {
    owners: [config[type].signer.address],
    threshold: 1,
  };

  const saltNonce = ethers.hexlify(ethers.toUtf8Bytes(type));

  // Predict deployed address
  const predictedDeploySafeAddress = await safeFactory.predictSafeAddress(
    safeAccountConfig,
    saltNonce,
  );

  console.log(
    `Predicted deployed Safe address for ${type}:`,
    predictedDeploySafeAddress,
  );

  if (await checkAddressExists(config, predictedDeploySafeAddress)) {
    console.log(` -> ${type} already deployed!`);
    return Safe.init({
      provider: config.rpc,
      safeAddress: predictedDeploySafeAddress,
      signer: config[type].signer.privateKey,
      contractNetworks: {
        [config.network.chainId.toString()]: config.safeAddresses,
      },
    });
  } else {
    console.log(` -> ${type} not found, deploying...`);
  }

  // Deploy Safe
  return safeFactory.deploySafe({
    safeAccountConfig,
    saltNonce,
    options: {
      nonce: await config.provider.getTransactionCount(
        config[type].signer.address,
      ),
    },
    callback: (txHash: string) => {
      console.log('-> Safe deployment tx hash:', txHash);
    },
  });
};

export const initChain = async (
  networkName: NetworkName,
): Promise<NetworkConfig> => {
  const rpc = getRpcUrl(networkName);
  const provider = new ethers.JsonRpcProvider(rpc);

  let network: ethers.Network | undefined;
  try {
    network = await Promise.race([
      provider.getNetwork(),
      awaitTimeout(5000, 'provider.getNetwork() timed out after 5 seconds'),
    ]);

    if (!network) {
      throw new Error(`Network not initialized`);
    }
  } catch (err) {
    console.log(err);
    process.exit(1);
  }

  const envSequencerOwners =
    process.env['REPORTER_ADDRESSES_' + kebabToSnakeCase(networkName)];
  const sequencerOwners = envSequencerOwners
    ? envSequencerOwners
        .split(',')
        .map(address => parseEthereumAddress(address))
    : [];

  const admin = new Wallet(getEnvString('ADMIN_SIGNER_PRIVATE_KEY'), provider);
  const envAdminOwners =
    process.env['ADMIN_EXTRA_SIGNERS_' + kebabToSnakeCase(networkName)];
  const adminOwners = envAdminOwners
    ? envAdminOwners.split(',').map(address => parseEthereumAddress(address))
    : [];

  const deploySequencerMultisig = JSON.parse(
    getOptionalEnvString(
      'DEPLOY_WITH_SEQUENCER_MULTISIG_' + kebabToSnakeCase(networkName),
      'true',
    ),
  );

  return {
    rpc,
    provider,
    network,
    sequencerMultisig: {
      signer: admin,
      owners: sequencerOwners,
      threshold: +getOptionalEnvString('REPORTER_THRESHOLD', '1'),
    },
    deployWithSequencerMultisig: deploySequencerMultisig,
    adminMultisig: {
      signer: admin,
      owners: adminOwners,
      threshold: +getOptionalEnvString('ADMIN_THRESHOLD', '1'),
    },
    safeAddresses: {
      multiSendAddress: parseEthereumAddress(
        '0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526',
      ),
      multiSendCallOnlyAddress: parseEthereumAddress(
        '0x9641d764fc13c8B624c04430C7356C1C7C8102e2',
      ),
      createCallAddress: parseEthereumAddress(
        '0x9b35Af71d77eaf8d7e40252370304687390A1A52',
      ),
      safeSingletonAddress: parseEthereumAddress(
        '0x41675C099F32341bf84BFc5382aF534df5C7461a',
      ),
      safeProxyFactoryAddress: parseEthereumAddress(
        '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67',
      ),
      fallbackHandlerAddress: parseEthereumAddress(
        '0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99',
      ),
      signMessageLibAddress: parseEthereumAddress(
        '0xd53cd0aB83D845Ac265BE939c57F53AD838012c9',
      ),
      simulateTxAccessorAddress: parseEthereumAddress(
        '0x3d4BA2E0884aa488718476ca2FB8Efc291A46199',
      ),
      safeWebAuthnSharedSignerAddress: parseEthereumAddress(
        // https://github.com/safe-global/safe-modules-deployments/blob/v2.2.4/src/assets/safe-passkey-module/v0.2.1/safe-webauthn-shared-signer.json#L6gs
        '0x94a4F6affBd8975951142c3999aEAB7ecee555c2',
      ),
      safeWebAuthnSignerFactoryAddress: parseEthereumAddress(
        // https://github.com/safe-global/safe-modules-deployments/blob/v2.2.4/src/assets/safe-passkey-module/v0.2.1/safe-webauthn-signer-factory.json#L6
        '0x1d31F259eE307358a26dFb23EB365939E8641195',
      ),
    },
  };
};

const predictAddress = async (
  artifacts: Artifacts,
  config: NetworkConfig,
  contractName: ContractNames,
  salt: string,
  args: string,
) => {
  const artifact = artifacts.readArtifactSync(contractName);
  const bytecode = ethers.solidityPacked(
    ['bytes', 'bytes'],
    [artifact.bytecode, args],
  );

  return ethers.getCreate2Address(
    config.safeAddresses.createCallAddress,
    salt,
    ethers.keccak256(bytecode),
  );
};

async function checkAddressExists(
  config: NetworkConfig,
  address: string,
): Promise<boolean> {
  const result = await config.provider.getCode(address);
  return result !== '0x';
}

async function multisigTxExec(
  transactions: SafeTransactionDataPartial[] | SafeTransaction,
  safe: Safe,
  multisigConfig: MultisigConfig,
  provider: NetworkConfig['provider'],
) {
  let tx: SafeTransaction;

  if (Array.isArray(transactions)) {
    if (transactions.length === 0) {
      console.log('No transactions to execute');
      return;
    }
    tx = await safe.createTransaction({
      transactions,
    });
  } else {
    tx = transactions;
  }

  console.log('\nProposing transaction...');

  const txResponse = await safe.executeTransaction(tx, {
    nonce: await provider.getTransactionCount(multisigConfig.signer.address),
  });

  const transaction = await provider.getTransaction(txResponse.hash);
  await transaction?.wait();
  console.log('-> tx hash', txResponse.hash);
  return parseTxHash(txResponse.hash);
}

const deployContracts = async (
  config: NetworkConfig,
  adminMultisig: Safe,
  artifacts: Artifacts,
  contracts: DeployContract[],
) => {
  const createCallAddress = config.safeAddresses.createCallAddress;

  const createCall = new ethers.Contract(
    createCallAddress,
    getCreateCallDeployment()?.abi!,
    config.adminMultisig.signer,
  );

  const ContractsConfigV2 = {} as ContractsConfigV2;
  ContractsConfigV2.coreContracts = {} as CoreContractsV2;

  const abiCoder = ethers.AbiCoder.defaultAbiCoder();

  const BATCH_LENGTH = 30;
  const transactions: SafeTransactionDataPartial[] = [];
  for (const [index, contract] of contracts.entries()) {
    const encodedArgs = abiCoder.encode(
      contract.argsTypes,
      contract.argsValues,
    );

    const artifact = artifacts.readArtifactSync(contract.name);
    const bytecode = ethers.solidityPacked(
      ['bytes', 'bytes'],
      [artifact.bytecode, encodedArgs],
    );

    const contractAddress = await predictAddress(
      artifacts,
      config,
      contract.name,
      contract.salt,
      encodedArgs,
    );

    const feedName = contract.feedRegistryInfo?.description;
    const contractName = feedName
      ? `CLAggregatorAdapter - ${feedName}`
      : contract.name;
    console.log(`Predicted address for '${contractName}': `, contractAddress);

    if (!(await checkAddressExists(config, contractAddress))) {
      const encodedData = createCall.interface.encodeFunctionData(
        'performCreate2',
        [0n, bytecode, contract.salt],
      );

      const safeTransactionData: SafeTransactionDataPartial = {
        to: createCallAddress,
        value: '0',
        data: encodedData,
        operation: OperationType.Call,
      };
      transactions.push(safeTransactionData);
    } else {
      console.log(' -> Contract already deployed!');
    }

    if (contract.name === ContractNames.CLAggregatorAdapter) {
      (ContractsConfigV2[contract.name] ??= []).push({
        description: contract.feedRegistryInfo?.description ?? '',
        base: contract.feedRegistryInfo?.base ?? null,
        quote: contract.feedRegistryInfo?.quote ?? null,
        address: parseEthereumAddress(contractAddress),
        constructorArgs: contract.argsValues,
      });
    } else {
      ContractsConfigV2.coreContracts[contract.name] = {
        address: parseEthereumAddress(contractAddress),
        constructorArgs: contract.argsValues,
      };
    }

    if (
      transactions.length === BATCH_LENGTH ||
      (index === contracts.length - 1 && transactions.length > 0)
    ) {
      await multisigTxExec(
        transactions,
        adminMultisig,
        config.adminMultisig,
        config.provider,
      );
      transactions.length = 0;
    }
  }

  return ContractsConfigV2;
};

const registerCLAggregatorAdapters = async (
  config: NetworkConfig,
  adminMultisig: Safe,
  deployData: ContractsConfigV2,
  artifacts: Artifacts,
) => {
  // The difference between setting n and n+1 feeds via CLFeedRegistryAdapter::setFeeds is slightly above 55k gas.
  console.log('\nRegistering CLAggregatorAdapters in CLFeedRegistryAdapter...');

  const registry = new ethers.Contract(
    deployData.coreContracts.CLFeedRegistryAdapter.address,
    artifacts.readArtifactSync(ContractNames.CLFeedRegistryAdapter).abi,
    config.adminMultisig.signer,
  );

  // Split into batches of 100
  const BATCH_LENGTH = 100;
  const batches: Array<Array<CLAggregatorAdapterData>> = [];
  const aggregatorData = deployData.CLAggregatorAdapter.filter(d => d.base);
  const filteredData = [];
  for (const data of aggregatorData) {
    const feed = await registry
      .connect(config.adminMultisig.signer)
      .getFunction('getFeed')(data.base, data.quote);

    if (feed === ethers.ZeroAddress) {
      filteredData.push(data);
    } else {
      console.log(` -> Feed '${data.description}' already registered`, {
        base: data.base,
        quote: data.quote,
        feed,
      });
    }
  }
  for (let i = 0; i < filteredData.length; i += BATCH_LENGTH) {
    batches.push(filteredData.slice(i, i + BATCH_LENGTH));
  }

  // Set feeds in batches
  for (const batch of batches) {
    const safeTransactionData: SafeTransactionDataPartial = {
      to: registry.target.toString(),
      value: '0',
      data: registry.interface.encodeFunctionData('setFeeds', [
        batch.map(({ base, quote, address }) => ({
          base,
          quote,
          feed: address,
        })),
      ]),
      operation: OperationType.Call,
    };

    await multisigTxExec(
      [safeTransactionData],
      adminMultisig,
      config.adminMultisig,
      config.provider,
    );
  }
};

const setupAccessControl = async (
  config: NetworkConfig,
  deployData: ContractsConfigV2,
  artifacts: Artifacts,
  adminMultisig: Safe,
  sequencerMultisig?: Safe,
) => {
  console.log('\nSetting sequencer role in sequencer guard...');

  const abiCoder = new ethers.AbiCoder();
  const transactions: SafeTransactionDataPartial[] = [];

  const guard = new ethers.Contract(
    deployData.coreContracts.OnlySequencerGuard.address,
    artifacts.readArtifactSync(ContractNames.OnlySequencerGuard).abi,
    config.adminMultisig.signer,
  );
  if (sequencerMultisig) {
    const isSequencerSet = await guard.getSequencerRole(
      config.sequencerMultisig.signer.address,
    );

    if (!isSequencerSet) {
      const safeTxSetGuard: SafeTransactionDataPartial = {
        to: guard.target.toString(),
        value: '0',
        data: guard.interface.encodeFunctionData('setSequencer', [
          getEnvString('SEQUENCER_ADDRESS'), // sequencer address
          true,
        ]),
        operation: OperationType.Call,
      };
      transactions.push(safeTxSetGuard);
    } else {
      console.log('Sequencer guard already set up');
    }
  }

  console.log(
    '\nSetting up access control and adding owners to admin multisig...',
  );

  const accessControl = new ethers.Contract(
    deployData.coreContracts.AccessControl.address,
    artifacts.readArtifactSync(ContractNames.AccessControl).abi,
    config.adminMultisig.signer,
  );

  const sequencerMultisigAddress = sequencerMultisig
    ? await sequencerMultisig.getAddress()
    : getEnvString('SEQUENCER_ADDRESS');

  const isAllowed = Boolean(
    Number(
      await config.sequencerMultisig.signer.call({
        to: accessControl.target.toString(),
        data: sequencerMultisigAddress,
      }),
    ),
  );

  if (!isAllowed) {
    const safeTxSetAccessControl: SafeTransactionDataPartial = {
      to: accessControl.target.toString(),
      value: '0',
      data: ethers.solidityPacked(
        ['address', 'bool'],
        [sequencerMultisigAddress, true],
      ),
      operation: OperationType.Call,
    };
    transactions.push(safeTxSetAccessControl);
  } else {
    console.log('Access control already set up');
  }

  const owners = await adminMultisig.getOwners();
  if (owners.length === 1 && config.adminMultisig.owners.length > 0) {
    const adminMultisigAddress = await adminMultisig.getAddress();
    for (const owner of config.adminMultisig.owners) {
      // addOwnerWithThreshold(address newOwner, uint256 threshold);
      const safeTxAddOwner: SafeTransactionDataPartial = {
        to: adminMultisigAddress,
        value: '0',
        data:
          '0x0d582f13' +
          abiCoder.encode(['address', 'uint256'], [owner, 1]).slice(2),
        operation: OperationType.Call,
      };
      transactions.push(safeTxAddOwner);
    }

    const prevOwnerAddress = config.adminMultisig.owners[0];
    // removeOwner(address prevOwner, address owner, uint256 threshold);
    const safeTxRemoveOwner: SafeTransactionDataPartial = {
      to: adminMultisigAddress,
      value: '0',
      data:
        '0xf8dc5dd9' +
        abiCoder
          .encode(
            ['address', 'address', 'uint256'],
            [
              prevOwnerAddress,
              config.adminMultisig.signer.address,
              config.adminMultisig.threshold,
            ],
          )
          .slice(2),
      operation: OperationType.Call,
    };
    transactions.push(safeTxRemoveOwner);
  }

  if (transactions.length > 0) {
    await multisigTxExec(
      transactions,
      adminMultisig,
      config.adminMultisig,
      config.provider,
    );

    if (owners.length === 1 && config.adminMultisig.owners.length > 0) {
      console.log(
        'Admin multisig owners changed to',
        await adminMultisig.getOwners(),
      );
      console.log('Removed signer from multisig owners');
      console.log('Current threshold', await adminMultisig.getThreshold());
    }
  }

  if (!!sequencerMultisig) {
    console.log(
      '\nSetting up sequencer guard, adding reporters as owners and removing sequencer from owners...',
    );

    const enabledGuard = await sequencerMultisig.getGuard();
    if (enabledGuard !== guard.target.toString()) {
      const sequencerMultisigAddress = await sequencerMultisig.getAddress();
      const sequencerTransactions: SafeTransactionDataPartial[] = [];

      // setGuard(address guard)
      const safeTxSetGuard: SafeTransactionDataPartial = {
        to: sequencerMultisigAddress,
        value: '0',
        data:
          '0xe19a9dd9' + abiCoder.encode(['address'], [guard.target]).slice(2),
        operation: OperationType.Call,
      };
      sequencerTransactions.push(safeTxSetGuard);

      for (const owner of config.sequencerMultisig.owners) {
        // addOwnerWithThreshold(address newOwner, uint256 threshold);
        const safeTxAddOwner: SafeTransactionDataPartial = {
          to: sequencerMultisigAddress,
          value: '0',
          data:
            '0x0d582f13' +
            abiCoder.encode(['address', 'uint256'], [owner, 1]).slice(2),
          operation: OperationType.Call,
        };
        sequencerTransactions.push(safeTxAddOwner);
      }

      const prevOwnerAddress = config.sequencerMultisig.owners[0];
      // removeOwner(address prevOwner, address owner, uint256 threshold);
      const safeTxRemoveOwner: SafeTransactionDataPartial = {
        to: sequencerMultisigAddress,
        value: '0',
        data:
          '0xf8dc5dd9' +
          abiCoder
            .encode(
              ['address', 'address', 'uint256'],
              [
                prevOwnerAddress,
                config.sequencerMultisig.signer.address,
                config.sequencerMultisig.threshold,
              ],
            )
            .slice(2),
        operation: OperationType.Call,
      };
      sequencerTransactions.push(safeTxRemoveOwner);

      await multisigTxExec(
        sequencerTransactions,
        sequencerMultisig,
        config.sequencerMultisig,
        config.provider,
      );

      console.log('Only sequencer guard set');
      console.log(
        'Sequencer multisig owners changed to reporters',
        await sequencerMultisig.getOwners(),
      );
      console.log('Removed sequencer from multisig owners');
      console.log('Current threshold', await sequencerMultisig.getThreshold());
    } else {
      console.log('Sequencer guard already set up');
    }
  }
};

const saveDeployment = async (
  configs: NetworkConfig[],
  chainsDeployment: DeploymentConfigV2,
) => {
  const fileName = 'evm_contracts_deployment_v2';
  const { decodeJSON, writeJSON } = selectDirectory(configDir);

  const deploymentContent = await decodeJSON(
    { name: fileName },
    DeploymentConfigSchemaV2,
  ).catch(() => ({}) as DeploymentConfigV2);

  for (const config of configs) {
    const networkName = getNetworkNameByChainId(
      parseChainId(config.network.chainId),
    );
    deploymentContent[networkName] = chainsDeployment[networkName];
  }
  await writeJSON({ name: fileName, content: deploymentContent });
};

const awaitTimeout = (delayMs: number, reason: string) =>
  new Promise<undefined>((resolve, reject) =>
    setTimeout(
      () => (reason === undefined ? resolve(undefined) : reject(reason)),
      delayMs,
    ),
  );
