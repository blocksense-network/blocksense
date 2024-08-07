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

interface ContractConfig {
  [chainId: string]: {
    [contractName in ContractNames]: string | Array<ChainlinkProxyData>;
  };
}

interface ChainlinkProxyData {
  description: string;
  base: string;
  quote: string;
  address: string;
}

enum ContractNames {
  SafeMultisig = 'SafeMultisig',
  FeedRegistry = 'FeedRegistry',
  ChainlinkProxy = 'ChainlinkProxy',
  HistoricDataFeedStoreV2 = 'HistoricDataFeedStoreV2',
  UpgradeableProxy = 'UpgradeableProxy',
}

enum NetworkNames {
  sepolia = 'ETH_SEPOLIA',
  holesky = 'ETH_HOLESKY',
  amoy = 'POLYGON_AMOY',
  manta = 'MANTA_SEPOLIA',
  fuji = 'AVAX_FUJI',
  chiado = 'GNOSIS_CHIADO',
  opSepolia = 'OPTIMISM_SEPOLIA',
  zkSyncSepolia = 'ZKSYNC_SEPOLIA',
  baseSepolia = 'BASE_SEPOLIA',
  specular = 'SPECULAR',
  scrollSepolia = 'SCROLL_SEPOLIA',
  arbSepolia = 'ARBITRUM_SEPOLIA',
  artio = 'BERA_ARTIO',
  hekla = 'TAIKO_HEKLA',
}

task('deploy', 'Deploy contracts')
  .addParam('networks', 'Network to deploy to')
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
      await fs.readFile('./config/data-feeds.json', 'utf8'),
    );

    let contractAddresses: ContractConfig = {};

    for (const config of configs) {
      const chainId = config.network.chainId.toString();

      console.log(`\n\n// ChainId: ${config.network.chainId} //`);
      const multisig = await deployMultisig(config);

      const abiCoder = ethers.AbiCoder.defaultAbiCoder();
      const artifact = artifacts.readArtifactSync(
        ContractNames.HistoricDataFeedStoreV2,
      );
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

      const multisigAddress = await multisig.getAddress();
      const addresses = await deployContracts(config, multisig, artifacts, [
        {
          name: ContractNames.HistoricDataFeedStoreV2,
          argsTypes: ['address'],
          argsValues: [config.signer.address],
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
          argsValues: [config.signer.address, dataFeedStoreAddress],
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
              data.key,
              dataFeedStoreAddress,
            ],
            salt: ethers.id('aggregator'),
            value: 0n,
            data: data,
          };
        }),
      ]);

      contractAddresses[chainId] = {
        ...addresses,
        SafeMultisig: multisigAddress,
      };

      await registerChainlinkProxies(config, addresses, artifacts);
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

    for (const config of configs) {
      const chainId = config.network.chainId.toString();
      parsedData[chainId] = contractAddresses[chainId];
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

const initChain = async (
  chianName: keyof typeof NetworkNames,
): Promise<NetworkConfig> => {
  const envName = NetworkNames[chianName];
  const rpc = process.env['RPC_URL_' + envName]!;
  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new Wallet(process.env['PRIV_KEY_' + envName]!, provider);
  const owners: string[] =
    process.env['OWNER_ADDRESSES_' + envName]?.split(',') || [];

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
    name: keyof typeof ContractNames;
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

  let contractAddresses = {} as {
    [contractName in ContractNames]: string | Array<ChainlinkProxyData>;
  };

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

    if (contract.name === ContractNames.ChainlinkProxy) {
      if (!contractAddresses[contract.name]) {
        contractAddresses[contract.name] = [];
      }
      (contractAddresses[contract.name] as Array<ChainlinkProxyData>).push({
        description: contract.data.description,
        base: contract.data.base,
        quote: contract.data.quote,
        address: contractAddress,
      });
    } else {
      contractAddresses[contract.name] = contractAddress;
    }
  }

  await multisigTxExec(transactions, multisig);

  return contractAddresses;
};

const registerChainlinkProxies = async (
  config: NetworkConfig,
  contracts: {
    [contractName in ContractNames]: string | Array<ChainlinkProxyData>;
  },
  artifacts: Artifacts,
) => {
  console.log('\nRegistering ChainlinkProxies in FeedRegistry...');
  // The difference between setting n and n+1 feeds via FeedRegistry::setFeeds is approximately 55k gas.

  // Split into batches of 100
  const batches: Array<Array<ChainlinkProxyData>> = [];
  if (Array.isArray(contracts.ChainlinkProxy)) {
    for (let i = 0; i < contracts.ChainlinkProxy.length; i += 100) {
      batches.push(contracts.ChainlinkProxy.slice(i, i + 100));
    }
  }

  const registry = new ethers.Contract(
    contracts.FeedRegistry as string,
    (await artifacts.readArtifact(ContractNames.FeedRegistry)).abi,
    config.signer,
  );

  // Set feeds in batches
  for (const batch of batches) {
    const tx = await registry.connect(config.signer).getFunction('setFeeds')(
      batch.map(data => {
        return { base: data.base, quote: data.quote, feed: data.address };
      }),
      { gasLimit: 20000 + 60 * 1000 * batch.length },
    );
    console.log('-> tx hash', tx.hash);
    await tx.wait();
  }
};
