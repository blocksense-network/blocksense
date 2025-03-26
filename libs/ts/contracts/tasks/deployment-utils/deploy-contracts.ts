import { parseEthereumAddress } from '@blocksense/base-utils';
import {
  CoreContractsV2,
  ContractsConfigV2,
} from '@blocksense/config-types/evm-contracts-deployment';
import Safe from '@safe-global/protocol-kit';
import {
  SafeTransactionDataPartial,
  OperationType,
} from '@safe-global/safe-core-sdk-types';
import { getCreateCallDeployment } from '@safe-global/safe-deployments';
import { task } from 'hardhat/config';
import { DeployContract, ContractNames, NetworkConfig } from '../types';
import { predictAddress, checkAddressExists } from '../utils';

task('deploy-contracts', '[UTILS] Deploy contracts to the network').setAction(
  async (args, { ethers, artifacts, run }) => {
    const {
      config,
      adminMultisig,
      contracts,
    }: {
      config: NetworkConfig;
      adminMultisig: Safe;
      contracts: DeployContract[];
    } = args;

    const signer = config.adminMultisig.signer || config.ledgerAccount;

    const createCallAddress = config.safeAddresses.createCallAddress;

    const createCall = new ethers.Contract(
      createCallAddress,
      getCreateCallDeployment()?.abi!,
      signer,
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
        await run('multisig-tx-exec', {
          transactions,
          safe: adminMultisig,
          config,
        });
        transactions.length = 0;
      }
    }

    return ContractsConfigV2;
  },
);
