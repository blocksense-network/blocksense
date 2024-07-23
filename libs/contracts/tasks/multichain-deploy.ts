import fs from 'fs/promises';
import path from 'path';
import { task } from 'hardhat/config';
import { Artifacts } from 'hardhat/types';
import { JsonRpcProvider, Network, Wallet, ethers } from 'ethers';
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

interface NetworkConfig {
  rpc: string;
  provider: JsonRpcProvider;
  network: Network;
  signer: Wallet;
  owners: string[];
  safeAddresses: {
    multiSendAddress: string;
    multiSendCallOnlyAddress: string;
    createCallAddress: string;
    safeSingletonAddress: string;
    safeProxyFactoryAddress: string;
    fallbackHandlerAddress: string;
    signMessageLibAddress: string;
    simulateTxAccessorAddress: string;
  };
  threshold: number;
}

task('deploy', 'Deploy contracts')
  .addParam('networks', 'Network to deploy to')
  .setAction(async (args, { ethers, artifacts }) => {
    const networks = args.networks.split(',');
    const configs: NetworkConfig[] = [];
    for (const network of networks) {
      switch (network) {
        case 'sepolia':
          configs.push(await initSepolia());
          break;
        case 'amoy':
          configs.push(await initAmoy());
          break;
        default:
          throw new Error(`Unknown network ${network}`);
      }
    }

    const multisigs: Safe[] = [];
    let contractAddresses: string[][] = [];
    for (const config of configs) {
      console.log(`\n\n// ChainId: ${config.network.chainId} //`);
      const multisig = await deployMultisig(config);
      multisigs.push(multisig);

      const abiCoder = ethers.AbiCoder.defaultAbiCoder();
      const artifact = artifacts.readArtifactSync('HistoricDataFeedStoreV2');
      const bytecode = ethers.solidityPacked(
        ['bytes', 'bytes'],
        [
          artifact.bytecode,
          abiCoder.encode(['address'], [config.signer.address]),
        ],
      );

      const dataFeedStoreAddress = ethers.getCreate2Address(
        config.safeAddresses.createCallAddress,
        ethers.id('dataFeedStore'),
        ethers.keccak256(bytecode),
      );

      const addresses = await deployContracts(config, multisig, artifacts, [
        {
          name: 'HistoricDataFeedStoreV2',
          encodedArgs: abiCoder.encode(['address'], [config.signer.address]),
          salt: ethers.id('dataFeedStore'),
          value: 0n,
        },
        {
          name: 'UpgradeableProxy',
          encodedArgs: abiCoder.encode(
            ['address', 'address'],
            [dataFeedStoreAddress, config.signer.address],
          ),
          salt: ethers.id('proxy'),
          value: 0n,
        },
        {
          name: 'ChainlinkProxy',
          encodedArgs: abiCoder.encode(
            ['string', 'uint8', 'uint32', 'address'],
            ['ETH/USD', 18, 1, dataFeedStoreAddress],
          ),
          salt: ethers.id('aggregator'),
          value: 0n,
        },
        {
          name: 'FeedRegistry',
          encodedArgs: abiCoder.encode(
            ['address', 'address'],
            [config.signer.address, dataFeedStoreAddress],
          ),
          salt: ethers.id('registry'),
          value: 0n,
        },
      ]);
      contractAddresses.push(addresses);
    }

    const file = process.cwd() + '/deployments/deploymentV1.json';
    try {
      await fs.open(file, 'r');
    } catch {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, '{}');
    }
    const jsonData = await fs.readFile(file, 'utf8');
    const parsedData = JSON.parse(jsonData);

    for (const [index, config] of configs.entries()) {
      parsedData[config.network.chainId.toString()] = {
        SafeMultisig: await multisigs[index].getAddress(),
        HistoricDataFeedStoreV2: contractAddresses[index][0],
        UpgradeableProxy: contractAddresses[index][1],
        ChainlinkProxy: contractAddresses[index][2],
        FeedRegistry: contractAddresses[index][3],
      };
    }

    await fs.writeFile(file, JSON.stringify(parsedData, null, 2), 'utf8');
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

  function callback(txHash: string) {
    console.log('-> Safe deployment tx hash:', txHash);
  }

  // Deploy Safe
  return safeFactory.deploySafe({
    safeAccountConfig,
    saltNonce,
    callback,
  });
};

const initSepolia = async (): Promise<NetworkConfig> => {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_SEPOLIA);
  const wallet = new Wallet(process.env.SEPOLIA_PK!, provider);
  const owners: string[] = process.env.SEPOLIA_OWNERS?.split(',') || [];

  return {
    rpc: process.env.RPC_SEPOLIA!,
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

const initAmoy = async (): Promise<NetworkConfig> => {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_AMOY);
  // const wallet = ethers.Wallet.fromPhrase(process.env.AMOY_MNEMONIC!, provider);
  const wallet = new Wallet(process.env.AMOY_PK!, provider);
  const owners: string[] = process.env.AMOY_OWNERS?.split(',') || [];

  return {
    rpc: process.env.RPC_AMOY!,
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

const multisigTxExec = async (
  transactions: SafeTransactionDataPartial[],
  safe: Safe,
) => {
  const tx: SafeTransaction = await safe.createTransaction({
    transactions,
  });

  const safeTransaction = await safe.signTransaction(tx);

  console.log('\nProposing transaction...');

  const txResponse = await safe.executeTransaction(safeTransaction);

  console.log('-> tx hash', txResponse.hash);
};

const deployContracts = async (
  config: NetworkConfig,
  multisig: Safe,
  artifacts: Artifacts,
  contracts: {
    name: string;
    encodedArgs: string;
    salt: string;
    value: bigint;
  }[],
) => {
  const createCallAddress = config.safeAddresses.createCallAddress;

  const createCall = new ethers.Contract(
    createCallAddress,
    getCreateCallDeployment()?.abi!,
    config.signer,
  );

  const contractAddresses: string[] = [];

  const transactions: SafeTransactionDataPartial[] = [];
  for (const contract of contracts) {
    const artifact = artifacts.readArtifactSync(contract.name);
    const bytecode = ethers.solidityPacked(
      ['bytes', 'bytes'],
      [artifact.bytecode, contract.encodedArgs],
    );

    const contractAddress = ethers.getCreate2Address(
      createCallAddress,
      contract.salt,
      ethers.keccak256(bytecode),
    );
    console.log(`\nPredicted ${contract.name} address`, contractAddress);

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

    contractAddresses.push(contractAddress);
  }

  await multisigTxExec(transactions, multisig);

  return contractAddresses;
};
