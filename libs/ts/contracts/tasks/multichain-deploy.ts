import { task } from 'hardhat/config';
import { Artifacts } from 'hardhat/types';
import { Wallet, concat, ethers, keccak256 } from 'ethers';
import { Provider, types, utils } from 'zksync-ethers';
import Safe, {
  getSafeContract,
  getSafeProxyFactoryContract,
  PredictedSafeProps,
  predictSafeAddress,
  SafeAccountConfig,
  SafeDeploymentConfig,
} from '@local/protocol-kit';
import {
  OperationType,
  SafeTransaction,
  SafeTransactionDataPartial,
} from '@safe-global/safe-core-sdk-types';

// import { createMemoizedFunction } from '@safe-global/protocol-kit/utils/memoized'

import { getCreateCallDeployment } from '@safe-global/safe-deployments';

import { NetworkConfig, ContractNames } from './types';
import {
  chainId,
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
import { Console, error } from 'console';
import { hashBytecode } from 'zksync-ethers/build/utils';
import { IChainlinkAggregator__factory } from '../typechain';
import singletonFactoryAbi from '../abis/ZksyncSingletonFactory.json';
// import {
//   encodeSetupCallData,
//   predictSafeAddress,
//   zkSyncEraCreate2Address,
// } from '@safe-global/protocol-kit/dist/src/contracts/utils';

const getZkSyncBytecodeHashFromDeployerCallHeader = (
  proxyCreationCode: string,
): string => {
  const decodedHeader = new ethers.AbiCoder().decode(
    ['bytes32', 'bytes32', 'bytes'],
    '0x' + proxyCreationCode.slice(10),
  );
  return decodedHeader[1];
};

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
    // const oldTx = (await configs[0].provider.getTransaction("0xa1a04491d5b81f3080289e0cb5d9893d9681bac63f110ffc41548437230a89ee"))!
    // console.log(oldTx)
    // const freeData = await configs[0].provider.getFeeData();
    // console.log(freeData.maxPriorityFeePerGas! * 5n);
    // console.log(freeData.maxFeePerGas! * 5n);

    // const tx = await configs[0].signer.sendTransaction({
    //   to: configs[0].signer.address,
    //   value: 0,
    //   nonce: 1,
    //   maxPriorityFeePerGas: oldTx.maxPriorityFeePerGas! * 2n,
    //   maxFeePerGas: oldTx.maxFeePerGas! * 2n,
    // });
    // console.log(tx);
    // await tx.wait();
    // return;

    // const bytecodeHashStr =
    //   '0x0000000000000000000000000000000000000000000000000000000000000000000000000100003b6cfa15bd7d1cae1c9c022074524d7785d34859ad0576d8fab4305d4f00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
    // const bytecodeHash = getZkSyncBytecodeHashFromDeployerCallHeader(bytecodeHashStr);

    // console.log('UUU',ethers.hexlify(bytecodeHash));

    // return null;
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
      console.log(multisigAddress);
      // return null;

      const dataFeedStoreAddress = await predictAddress(
        artifacts,
        config,
        ContractNames.HistoricDataFeedStoreV2,
        ethers.id('dataFeedStore1212123123'),
        abiCoder.encode(['address'], [process.env.SEQUENCER_ADDRESS]),
      );
      const upgradeableProxyAddress = await predictAddress(
        artifacts,
        config,
        ContractNames.UpgradeableProxy,
        ethers.id('proxy69696'),
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
          salt: ethers.id('dataFeedStore1212123123'),
          value: 0n,
        },
        {
          name: ContractNames.UpgradeableProxy,
          argsTypes: ['address', 'address'],
          argsValues: [dataFeedStoreAddress, multisigAddress],
          salt: ethers.id('proxy69696'),
          value: 0n,
        },
        {
          name: ContractNames.FeedRegistry,
          argsTypes: ['address', 'address'],
          argsValues: [multisigAddress, upgradeableProxyAddress],
          salt: ethers.id('registrsafdsdfy'),
          value: 0n,
        },
        ...dataFeedConfig.slice(0, 1).map(data => {
          return {
            name: ContractNames.ChainlinkProxy as const,
            argsTypes: ['string', 'uint8', 'uint32', 'address'],
            argsValues: [
              data.description,
              data.decimals,
              data.id,
              upgradeableProxyAddress,
            ],
            salt: ethers.id('aggregatorasasasa'),
            value: 0n,
            feedRegistryInfo: {
              description: data.description,
              base: data.base,
              quote: data.quote,
            },
          };
        }),
      ]);

      console.log('deployData', deployData.coreContracts);
      return null;
      const networkName = getNetworkNameByChainId(chainId);
      chainsDeployment[networkName] = {
        chainId,
        contracts: {
          ...deployData,
          SafeMultisig: parseEthereumAddress(multisigAddress),
        },
      };
      const signerBalancePost = await config.provider.getBalance(config.signer);
      console.log(`// balance: ${signerBalancePost} //`);
      console.log(`// balance diff: ${signerBalance - signerBalancePost} //`);

      await registerChainlinkProxies(config, multisig, deployData, artifacts);
    }

    await saveDeployment(configs, chainsDeployment);
  });

const deployMultisig = async (config: NetworkConfig) => {
  const safeVersion = '1.4.1';
  const canonicalVersion = '';
  const zksync = '';
  const saltNonce = '123';

  const safeAccountConfig: SafeAccountConfig = {
    owners: config.owners,
    threshold: config.threshold,
  };

  const safeDeploymentConfig: SafeDeploymentConfig = {
    saltNonce,
    safeVersion,
    deploymentType: config.zksync ? 'zksync' : 'canonical',
  };
  const predictedSafe: PredictedSafeProps = {
    safeAccountConfig,
    safeDeploymentConfig,
  };

  const protocolKit = await Safe.init({
    provider: config.rpc,
    signer: config.signer.privateKey,
    predictedSafe,
    contractNetworks: {
      [config.network.chainId.toString()]: config.safeAddresses,
    },
  });

  const safeFactory = await getSafeContract({
    safeProvider: protocolKit.getSafeProvider(),
    safeVersion,
    customContracts: config.safeAddresses,
    deploymentType: 'zksync',
  });

  // console.log(
  //   'HELP: ',
  //   await config.provider.getCode(safeFactory.getAddress()),
  // );

  // const safeFactory = await getSafeProxyFactoryContract({
  //   safeProvider: protocolKit.getSafeProvider(),
  //   safeVersion,
  //   customContracts: config.safeAddresses,
  //   deploymentType: 'zksync'
  // });

  // console.log('HELP: ',await safeFactory.proxyCreationCode())

  // Predict deployed address
  let predictedDeploySafeAddress = await protocolKit.getAddress();

  // 0xBB13C837e64cb79c0274742BC3c0F4BB6521eFe4
  // 0xd5319F79435d5aBb99f6833B6EF8ecE30630F42b
  console.log('Predicted deployed Safe address:', predictedDeploySafeAddress);

  if (await checkAddressExists(config, predictedDeploySafeAddress)) {
    console.log(' -> Safe already deployed!');
    return protocolKit.connect({
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
  const deploymentTransaction =
    await protocolKit.createSafeDeploymentTransaction();
  const txHash = await config.signer.sendTransaction({
    to: deploymentTransaction.to,
    value: BigInt(deploymentTransaction.value),
    data: deploymentTransaction.data,
  });

  // await config.provider.waitForTransaction(txHash.wait)
  await txHash.wait();

  return protocolKit.connect({
    provider: config.rpc,
    safeAddress: predictedDeploySafeAddress,
    signer: config.signer.privateKey,
    contractNetworks: {
      [config.network.chainId.toString()]: config.safeAddresses,
    },
  });
  // Deploy Safe
};

const initChain = async (networkName: NetworkName): Promise<NetworkConfig> => {
  const rpc = getRpcUrl(networkName);
  const provider = new ethers.JsonRpcProvider(rpc);
  const zksyncProvider = Provider.getDefaultProvider(types.Network.Sepolia);
  console.log('networkName ', networkName);
  const wallet = new Wallet(getEnvString('SIGNER_PRIVATE_KEY'), provider);
  const envOwners =
    process.env['OWNER_ADDRESSES_' + kebabToSnakeCase(networkName)];
  const owners = envOwners
    ? envOwners.split(',').map(address => parseEthereumAddress(address))
    : [];
  if (networkName.split('-')[0] != 'zksync') {
    return {
      rpc,
      provider,
      zksync: false,
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
  } else {
    console.log('ZKSYNC BABYYYYYYYYYYYYYYYYYYYY');

    return {
      rpc,
      provider: zksyncProvider,
      zksync: true,
      network: await provider.getNetwork(),
      signer: wallet,
      owners: [...owners, parseEthereumAddress(wallet.address)],
      safeAddresses: {
        multiSendAddress: parseEthereumAddress(
          '0x309D0B190FeCCa8e1D5D8309a16F7e3CB133E885',
        ),
        multiSendCallOnlyAddress: parseEthereumAddress(
          '0x0408EF011960d02349d50286D20531229BCef773',
        ),
        createCallAddress: parseEthereumAddress(
          '0xAAA566Fe7978bB0fb0B5362B7ba23038f4428D8f',
        ),
        safeSingletonAddress: parseEthereumAddress(
          '0xC35F063962328aC65cED5D4c3fC5dEf8dec68dFa',
        ),
        safeProxyFactoryAddress: parseEthereumAddress(
          '0xc329D02fd8CB2fc13aa919005aF46320794a8629',
        ),
        fallbackHandlerAddress: parseEthereumAddress(
          '0x9301E98DD367135f21bdF66f342A249c9D5F9069',
        ),
        signMessageLibAddress: parseEthereumAddress(
          '0xAca1ec0a1A575CDCCF1DC3d5d296202Eb6061888',
        ),
        simulateTxAccessorAddress: parseEthereumAddress(
          '0xdd35026932273768A3e31F4efF7313B5B7A7199d',
        ),
        safeWebAuthnSharedSignerAddress: parseEthereumAddress(
          '0x94a4F6affBd8975951142c3999aEAB7ecee555c2',
        ),
        safeWebAuthnSignerFactoryAddress: parseEthereumAddress(
          '0x1d31F259eE307358a26dFb23EB365939E8641195',
        ),
      },
      threshold: 1,
    };
  }
};

const predictAddress = async (
  artifacts: Artifacts,
  config: NetworkConfig,
  contractName: ContractNames,
  salt: string,
  args: string,
) => {
  // console.log('Calculation predict address');

  const artifact = artifacts.readArtifactSync(contractName);
  const bytecode = ethers.solidityPacked(
    ['bytes', 'bytes'],
    [artifact.bytecode, args],
  );

  if (config.zksync) {
    const PREDEPLOYED_CREATE2_ADDRESS =
      '0x0000000000000000000000000000000000010000';
    return utils.create2Address(
      PREDEPLOYED_CREATE2_ADDRESS,
      ethers.hexlify(utils.hashBytecode(artifact.bytecode)),
      salt,
      args,
    );
  } else {
    return ethers.getCreate2Address(
      config.safeAddresses.createCallAddress,
      salt,
      ethers.keccak256(bytecode),
    );
  }
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
  factoryDeps?: string[],
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
  // console.log(`--------------config.provider.getBlock('latest')------------------`);
  // console.log(await config.provider.getBlock('latest'));
  // console.log("gasLimit: ",gasLimit);

  // console.log('now we get transactionResponse');
  const feeData = await config.provider.getFeeData();

  const txResponse = await safe.executeTransaction(safeTransaction, {
    gasLimit: (gasLimit + 100_000n).toString(),
    nonce: await config.provider.getTransactionCount(config.signer.address),
    customData: { factoryDeps },
  });
  // console.log('-> transactionResponse', txResponse.transactionResponse);

  // transactionResponse is of unknown type and there is no type def in the specs
  const receipt = await (txResponse.transactionResponse as any).wait();
  // console.log('-> transactionResponse', txResponse.transactionResponse);

  console.log('-> tx hash', txResponse.hash);
  if (receipt.status == 'reverted') {
    throw new Error('Neti e gotina');
  }
  console.log('receipt ', receipt);
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
  let createCall: ethers.Contract;

  if (config.zksync) {
    const PREDEPLOYED_CREATE2_ADDRESS =
      '0x0000000000000000000000000000000000010000';

    createCall = new ethers.Contract(
      PREDEPLOYED_CREATE2_ADDRESS,
      singletonFactoryAbi,
      config.signer,
    );
  } else {
    const createCallAddress = config.safeAddresses.createCallAddress;
    createCall = new ethers.Contract(
      createCallAddress,
      getCreateCallDeployment()?.abi!,
      config.signer,
    );
  }

  const createCallAddress = config.safeAddresses.createCallAddress;

  // const createCall = new ethers.Contract(
  //   createCallAddress,
  //   getCreateCallDeployment()?.abi!,
  //   config.signer,
  // );

  const contractsConfig = {} as ContractsConfig;
  contractsConfig.coreContracts = {} as CoreContracts;

  const abiCoder = ethers.AbiCoder.defaultAbiCoder();

  const transactions: SafeTransactionDataPartial[] = [];

  const factoryDeps: string[] = [];
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
      let encodedData: string;
      if (config.zksync) {
        encodedData = createCall.interface.encodeFunctionData('create2', [
          contract.salt,
          ethers.hexlify(utils.hashBytecode(artifact.bytecode)),
          encodedArgs,
        ]);
        factoryDeps.push(artifact.bytecode);
      } else {
        encodedData = createCall.interface.encodeFunctionData(
          'performCreate2',
          [0n, bytecode, contract.salt],
        );
      }
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
      factoryDeps,
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
