import {
  SafeTransactionDataPartial,
  OperationType,
} from '@safe-global/safe-core-sdk-types';
import Safe from '@safe-global/protocol-kit';
import { getCreateCallDeployment } from '@safe-global/safe-deployments';
import { AbiCoder, Contract, solidityPacked } from 'ethers';
import { Artifacts } from 'hardhat/types';

import { assertNotNull, parseEthereumAddress } from '@blocksense/base-utils';
import { ContractsConfigV2 } from '@blocksense/config-types/evm-contracts-deployment';

import { DeployContract, ContractNames, NetworkConfig } from '../types';
import { predictAddress, checkAddressExists } from '../utils';
import { executeMultisigTransaction } from './multisig-tx-exec';

type Params = {
  config: NetworkConfig;
  adminMultisig: Safe;
  contracts: DeployContract[];
  artifacts: Artifacts;
};

export async function deployContracts({
  config,
  adminMultisig,
  contracts,
  artifacts,
}: Params) {
  const createCallAddress = config.safeAddresses.createCallAddress;

  const createCall = new Contract(
    createCallAddress,
    getCreateCallDeployment()?.abi!,
    config.deployer,
  );

  const ContractsConfigV2 = {
    coreContracts: {},
    safe: {},
    CLAggregatorAdapter: {},
  } as ContractsConfigV2;

  const abiCoder = AbiCoder.defaultAbiCoder();

  const BATCH_LENGTH = 30;
  const transactions: SafeTransactionDataPartial[] = [];
  for (const [index, contract] of contracts.entries()) {
    const encodedArgs = abiCoder.encode(
      contract.argsTypes,
      contract.argsValues,
    );

    const artifact = artifacts.readArtifactSync(contract.name);
    const bytecode = solidityPacked(
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
      console.log(`  -> ✅ already deployed`);
    }

    if (contract.name === ContractNames.CLAggregatorAdapter) {
      const registryInfo = assertNotNull(
        contract.feedRegistryInfo,
        `CLAggregatorAdapter without registry info: ${contract}`,
      );
      ContractsConfigV2.CLAggregatorAdapter[`${registryInfo.feedId}`] = {
        feedId: registryInfo.feedId,
        base: registryInfo.base,
        quote: registryInfo.quote,
        address: parseEthereumAddress(contractAddress),
        constructorArgs: contract.argsValues,
        salt: contract.salt,
      };
    } else if (
      contract.name === ContractNames.OnlySequencerGuard ||
      contract.name === ContractNames.AdminExecutorModule
    ) {
      ContractsConfigV2.safe[contract.name] = {
        address: parseEthereumAddress(contractAddress),
        constructorArgs: contract.argsValues,
        salt: contract.salt,
      };
    } else {
      ContractsConfigV2.coreContracts[contract.name] = {
        address: parseEthereumAddress(contractAddress),
        constructorArgs: contract.argsValues,
        salt: contract.salt,
      };
    }

    if (
      transactions.length === BATCH_LENGTH ||
      (index === contracts.length - 1 && transactions.length > 0)
    ) {
      await executeMultisigTransaction({
        transactions,
        safe: adminMultisig,
        config,
      });
      transactions.length = 0;
    }
  }

  return ContractsConfigV2;
}
