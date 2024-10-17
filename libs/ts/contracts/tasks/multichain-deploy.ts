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

import { NetworkConfig, ContractNames } from './types';
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

import { getEnvString, configDir } from '@blocksense/base-utils/env';
import { selectDirectory } from '@blocksense/base-utils/fs';
import { kebabToSnakeCase } from '@blocksense/base-utils/string';

import { ChainlinkCompatibilityConfigSchema } from '@blocksense/config-types/chainlink-compatibility';
import { FeedsConfigSchema } from '@blocksense/config-types/data-feeds-config';
import {
  ChainlinkProxyData,
  ContractsConfig,
  CoreContracts,
  DeploymentConfig,
  DeploymentConfigSchema,
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
      { name: 'feeds_config' },
      FeedsConfigSchema,
    );
    const chainlinkCompatibility = await decodeJSON(
      { name: 'chainlink_compatibility' },
      ChainlinkCompatibilityConfigSchema,
    );

    const dataFeedConfig = feeds.map(feed => {
      const { base, quote } =
        chainlinkCompatibility.blocksenseFeedsCompatibility[feed.id]
          .chainlink_compatibility;
      return {
        id: feed.id,
        description: feed.description,
        decimals: feed.decimals,
        base,
        quote,
      };
    });

    const chainsDeployment: DeploymentConfig = {} as DeploymentConfig;

    const abiCoder = ethers.AbiCoder.defaultAbiCoder();

    for (const config of configs) {
      const chainId = parseChainId(config.network.chainId);
      console.log(`\n\n// ChainId: ${config.network.chainId}`);
      console.log(`// Signer: ${config.signer.address}`);
      const signerBalance = await config.provider.getBalance(config.signer);
      console.log(`// balance: ${signerBalance} //`);

      const multisig = await deployMultisig(config);
      const multisigAddress = await multisig.getAddress();

      const dataFeedStoreAddress = await predictAddress(
        artifacts,
        config,
        ContractNames.HistoricDataFeedStoreV2,
        ethers.id('dataFeedStore'),
        abiCoder.encode(['address'], [process.env.SEQUENCER_ADDRESS]),
      );
      const upgradeableProxyAddress = await predictAddress(
        artifacts,
        config,
        ContractNames.UpgradeableProxy,
        ethers.id('proxy'),
        abiCoder.encode(
          ['address', 'address'],
          [dataFeedStoreAddress, multisigAddress],
        ),
      );

      const deployData = await deployContracts(config, multisig, artifacts, [
        {
          name: ContractNames.HistoricDataFeedStoreV2,
          argsTypes: ['address'],
          argsValues: [process.env.SEQUENCER_ADDRESS],
          salt: ethers.id('dataFeedStore'),
          value: 0n,
        },
        {
          name: ContractNames.UpgradeableProxy,
          argsTypes: ['address', 'address'],
          argsValues: [dataFeedStoreAddress, multisigAddress],
          salt: ethers.id('proxy'),
          value: 0n,
        },
        {
          name: ContractNames.FeedRegistry,
          argsTypes: ['address', 'address'],
          argsValues: [multisigAddress, upgradeableProxyAddress],
          salt: ethers.id('registry'),
          value: 0n,
        },
        ...dataFeedConfig.map(data => {
          return {
            name: ContractNames.ChainlinkProxy as const,
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
      ]);

      const networkName = getNetworkNameByChainId(chainId);
      chainsDeployment[networkName] = {
        chainId,
        contracts: {
          ...deployData,
          SafeMultisig: parseEthereumAddress(multisigAddress),
        },
      };

      await registerChainlinkProxies(config, multisig, deployData, artifacts);
    }

    await saveDeployment(configs, chainsDeployment);
  });

const deployMultisig = async (config: NetworkConfig) => {
  const safeVersion = '1.4.1';

  // Create SafeFactory instance
  const safeFactory = await SafeFactory.init({
    provider: config.rpc,
    signer: config.signer.privateKey,
    safeVersion,
    contractNetworks: {
      [config.network.chainId.toString()]: config.safeAddresses,
    },
  });

  console.log('\nSafeFactory address:', await safeFactory.getAddress());

  const safeAccountConfig: SafeAccountConfig = {
    owners: config.owners,
    threshold: config.threshold,
  };
  const saltNonce = '150000';

  // Predict deployed address
  const predictedDeploySafeAddress = await safeFactory.predictSafeAddress(
    safeAccountConfig,
    saltNonce,
  );

  console.log('Predicted deployed Safe address:', predictedDeploySafeAddress);

  if (await checkAddressExists(config, predictedDeploySafeAddress)) {
    console.log(' -> Safe already deployed!');
    return Safe.init({
      provider: config.rpc,
      safeAddress: predictedDeploySafeAddress,
      signer: config.signer.privateKey,
      contractNetworks: {
        [config.network.chainId.toString()]: config.safeAddresses,
      },
    });
  } else {
    console.log(' -> Safe not found, deploying...');
  }

  // Deploy Safe
  return safeFactory.deploySafe({
    safeAccountConfig,
    saltNonce,
    options: {
      nonce: await config.provider.getTransactionCount(config.signer.address),
    },
    callback: (txHash: string) => {
      console.log('-> Safe deployment tx hash:', txHash);
    },
  });
};

const initChain = async (networkName: NetworkName): Promise<NetworkConfig> => {
  const rpc = getRpcUrl(networkName);
  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new Wallet(getEnvString('SIGNER_PRIVATE_KEY'), provider);
  const envOwners =
    process.env['OWNER_ADDRESSES_' + kebabToSnakeCase(networkName)];
  const owners = envOwners
    ? envOwners.split(',').map(address => parseEthereumAddress(address))
    : [];
  return {
    rpc,
    provider,
    network: await provider.getNetwork(),
    signer: wallet,
    owners: [...owners, parseEthereumAddress(wallet.address)],
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
    threshold: 1,
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

const multisigTxExec = async (
  transactions: SafeTransactionDataPartial[],
  safe: Safe,
  config: NetworkConfig,
  gasLimit: bigint,
) => {
  if (transactions.length === 0) {
    console.log('No transactions to execute');
    return;
  }

  const tx: SafeTransaction = await safe.createTransaction({
    transactions,
  });

  const safeTransaction = await safe.signTransaction(tx);

  console.log('\nProposing transaction...');

  const txResponse = await safe.executeTransaction(safeTransaction, {
    gasLimit: (gasLimit + 100_000n).toString(),
    nonce: await config.provider.getTransactionCount(config.signer.address),
  });

  // transactionResponse is of unknown type and there is no type def in the specs
  await (txResponse.transactionResponse as any).wait();
  console.log('-> tx hash', txResponse.hash);
  return parseTxHash(txResponse.hash);
};

const deployContracts = async (
  config: NetworkConfig,
  multisig: Safe,
  artifacts: Artifacts,
  contracts: {
    name: Exclude<ContractNames, ContractNames.SafeMultisig>;
    argsTypes: string[];
    argsValues: any[];
    salt: string;
    value: bigint;
    feedRegistryInfo?: {
      description: string;
      base: EthereumAddress | null;
      quote: EthereumAddress | null;
    };
  }[],
) => {
  const createCallAddress = config.safeAddresses.createCallAddress;

  const createCall = new ethers.Contract(
    createCallAddress,
    getCreateCallDeployment()?.abi!,
    config.signer,
  );

  const contractsConfig = {} as ContractsConfig;
  contractsConfig.coreContracts = {} as CoreContracts;

  const abiCoder = ethers.AbiCoder.defaultAbiCoder();

  const transactions: SafeTransactionDataPartial[] = [];
  for (const contract of contracts) {
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
      ? `ChainlinkProxy - ${feedName}`
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

    if (contract.name === ContractNames.ChainlinkProxy) {
      (contractsConfig[contract.name] ??= []).push({
        description: contract.feedRegistryInfo?.description ?? '',
        base: contract.feedRegistryInfo?.base ?? null,
        quote: contract.feedRegistryInfo?.quote ?? null,
        address: parseEthereumAddress(contractAddress),
        constructorArgs: contract.argsValues,
      });
    } else {
      contractsConfig.coreContracts[contract.name] = {
        address: parseEthereumAddress(contractAddress),
        constructorArgs: contract.argsValues,
      };
    }
  }

  // deploying 30 contracts in a single transaction costs about 12.6m gas
  const BATCH_LENGTH = 30;
  const batches = Math.ceil(transactions.length / BATCH_LENGTH);
  for (let i = 0; i < batches; i++) {
    const batch = transactions.slice(i * BATCH_LENGTH, (i + 1) * BATCH_LENGTH);
    await multisigTxExec(
      batch,
      multisig,
      config,
      500_000n * BigInt(batch.length),
    );
  }

  return contractsConfig;
};

const registerChainlinkProxies = async (
  config: NetworkConfig,
  multisig: Safe,
  deployData: ContractsConfig,
  artifacts: Artifacts,
) => {
  // The difference between setting n and n+1 feeds via FeedRegistry::setFeeds is slightly above 55k gas.
  console.log('\nRegistering ChainlinkProxies in FeedRegistry...');

  const registry = new ethers.Contract(
    deployData.coreContracts.FeedRegistry.address,
    artifacts.readArtifactSync(ContractNames.FeedRegistry).abi,
    config.signer,
  );

  // Split into batches of 100
  const BATCH_LENGTH = 100;
  const batches: Array<Array<ChainlinkProxyData>> = [];
  const proxyData = deployData.ChainlinkProxy.filter(d => d.base);
  const filteredData = [];
  for (const data of proxyData) {
    const feed = await registry.connect(config.signer).getFunction('getFeed')(
      data.base,
      data.quote,
    );

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
        batch.map(({ base, quote, address }) => {
          return { base, quote, feed: address };
        }),
      ]),
      operation: OperationType.Call,
    };

    await multisigTxExec(
      [safeTransactionData],
      multisig,
      config,
      60_000n * BigInt(batch.length),
    );
  }
};

const saveDeployment = async (
  configs: NetworkConfig[],
  chainsDeployment: DeploymentConfig,
) => {
  const fileName = 'evm_contracts_deployment_v1';
  const { decodeJSON, writeJSON } = selectDirectory(configDir);

  const deploymentContent = await decodeJSON(
    { name: fileName },
    DeploymentConfigSchema,
  ).catch(() => ({}) as DeploymentConfig);

  for (const config of configs) {
    const networkName = getNetworkNameByChainId(
      parseChainId(config.network.chainId),
    );
    deploymentContent[networkName] = chainsDeployment[networkName];
  }
  await writeJSON({ name: fileName, content: deploymentContent });
};
