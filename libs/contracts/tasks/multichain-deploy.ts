import fs from 'fs/promises';
import path from 'path';
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
  NetworkNames,
  ChainConfig,
  ContractNames,
  ContractsConfig,
  CoreContract,
  ChainlinkProxyData,
} from './types';

const fileName = '/deployments/deploymentV1.json';

task('deploy', 'Deploy contracts')
  .addParam('networks', 'Network to deploy to')
  .addParam('configFile', 'Path to config file')
  .setAction(async (args, { ethers, artifacts }) => {
    const networks = args.networks.split(',');
    const configs: NetworkConfig[] = [];
    const testNetworks = Object.keys(NetworkNames);
    for (const network of networks) {
      if (!testNetworks.includes(network)) {
        throw new Error(`Invalid network: ${network}`);
      }
      configs.push(await initChain(network as keyof typeof NetworkNames));
    }

    const dataFeedConfig = JSON.parse(
      await fs.readFile(args.configFile, 'utf8'),
    ).feeds;

    const chainsDeployment: ChainConfig = {};

    const abiCoder = ethers.AbiCoder.defaultAbiCoder();

    for (const config of configs) {
      const chainId = config.network.chainId.toString();

      console.log(`\n\n// ChainId: ${config.network.chainId} //`);
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
        ...dataFeedConfig.map((data: any) => {
          return {
            name: ContractNames.ChainlinkProxy,
            argsTypes: ['string', 'uint8', 'uint32', 'address'],
            argsValues: [
              data.description,
              data.decimals,
              data.id,
              upgradeableProxyAddress,
            ],
            salt: ethers.id('aggregator'),
            value: 0n,
            data: data,
          };
        }),
      ]);

      chainsDeployment[chainId] = {
        name: configs[0].network.name,
        contracts: {
          ...deployData,
          SafeMultisig: multisigAddress,
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
    });
  }

  // Deploy Safe
  return safeFactory.deploySafe({
    safeAccountConfig,
    saltNonce,
    callback: (txHash: string) => {
      console.log('-> Safe deployment tx hash:', txHash);
    },
  });
};

const initChain = async (
  chianName: keyof typeof NetworkNames,
): Promise<NetworkConfig> => {
  const envName = NetworkNames[chianName];
  const rpc = process.env['RPC_URL_' + envName]!;
  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new Wallet(process.env['PRIV_KEY_' + envName]!, provider);
  const envOwners = process.env['OWNER_ADDRESSES_' + envName];
  const owners: string[] = envOwners ? envOwners.split(',') : [];

  return {
    rpc,
    provider,
    network: await provider.getNetwork(),
    signer: wallet,
    owners: [...owners, wallet.address],
    safeAddresses: {
      multiSendAddress: '0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526',
      multiSendCallOnlyAddress: '0x9641d764fc13c8B624c04430C7356C1C7C8102e2',
      createCallAddress: '0x9b35Af71d77eaf8d7e40252370304687390A1A52',
      safeSingletonAddress: '0x41675C099F32341bf84BFc5382aF534df5C7461a',
      safeProxyFactoryAddress: '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67',
      fallbackHandlerAddress: '0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99',
      signMessageLibAddress: '0xd53cd0aB83D845Ac265BE939c57F53AD838012c9',
      simulateTxAccessorAddress: '0x3d4BA2E0884aa488718476ca2FB8Efc291A46199',
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

  const txResponse = await safe.executeTransaction(safeTransaction);

  // transactionResponse is of unknown type and there is no type def in the specs
  await (txResponse.transactionResponse as any).wait();
  console.log('-> tx hash', txResponse.hash);
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
    data: any;
  }[],
) => {
  const createCallAddress = config.safeAddresses.createCallAddress;

  const createCall = new ethers.Contract(
    createCallAddress,
    getCreateCallDeployment()?.abi!,
    config.signer,
  );

  const contractAddresses = {} as ContractsConfig;
  contractAddresses.coreContracts = {} as CoreContract;

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

    console.log(`\nPredicted ${contract.name} address`, contractAddress);

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
      if (!contractAddresses[contract.name]) {
        contractAddresses[contract.name] = [];
      }

      let base = undefined;
      let quote = undefined;
      let chainlinkProxyAddress = undefined;

      if (contract.data.chainlink_compatibility) {
        if (typeof contract.data.chainlink_compatibility.base === 'string') {
          base = contract.data.chainlink_compatibility.base;
        } else if (
          typeof contract.data.chainlink_compatibility.base === 'object'
        ) {
          base =
            contract.data.chainlink_compatibility.base[
              config.network.chainId.toString()
            ];
        }

        if (typeof contract.data.chainlink_compatibility.quote === 'string') {
          quote = contract.data.chainlink_compatibility.quote;
        } else if (
          typeof contract.data.chainlink_compatibility.quote === 'object'
        ) {
          quote =
            contract.data.chainlink_compatibility.quote[
              config.network.chainId.toString()
            ];
        }

        if (contract.data.chainlink_compatibility.chainlink_proxy) {
          chainlinkProxyAddress =
            contract.data.chainlink_compatibility.chainlink_proxy[
              config.network.chainId.toString()
            ];
        }
      }

      contractAddresses[contract.name].push({
        description: contract.data.description,
        base: base && quote ? base : undefined,
        quote: base && quote ? quote : undefined,
        address: contractAddress,
        constructorArgs: contract.argsValues,
        chainlink_aggregator: chainlinkProxyAddress,
      });
    } else {
      contractAddresses.coreContracts[contract.name] = {
        address: contractAddress,
        constructorArgs: contract.argsValues,
      };
    }
  }

  // deploying 30 contracts in a single transaction costs about 12.6m gas
  const BATCH_LENGTH = 30;
  const batches = Math.ceil(transactions.length / BATCH_LENGTH);
  for (let i = 0; i < batches; i++) {
    const batch = transactions.slice(i * BATCH_LENGTH, (i + 1) * BATCH_LENGTH);
    await multisigTxExec(batch, multisig);
  }

  return contractAddresses;
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
      console.log(' -> Feed already registered', {
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
        batch.map(data => {
          return { base: data.base, quote: data.quote, feed: data.address };
        }),
      ]),
      operation: OperationType.Call,
    };

    await multisigTxExec([safeTransactionData], multisig);
  }
};

const saveDeployment = async (
  configs: NetworkConfig[],
  chainsDeployment: ChainConfig,
) => {
  const file = process.cwd() + fileName;
  try {
    await fs.open(file, 'r');
  } catch {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, '{}');
  }
  const jsonData = await fs.readFile(file, 'utf8');
  const parsedData = JSON.parse(jsonData);

  for (const config of configs) {
    const chainId = config.network.chainId.toString();
    parsedData[chainId] = chainsDeployment[chainId];
  }

  await fs.writeFile(file, JSON.stringify(parsedData, null, 2), 'utf8');
};
