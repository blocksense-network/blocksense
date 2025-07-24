import Safe, {
  SafeAccountConfig,
  PredictedSafeProps,
  predictSafeAddress,
} from '@safe-global/protocol-kit';
import { hexlify, toUtf8Bytes, TransactionRequest } from 'ethers';

import { NetworkConfig } from '../types';
import { checkAddressExists } from '../utils';

type Params = {
  config: NetworkConfig;
  type: keyof Pick<NetworkConfig, 'adminMultisig' | 'reporterMultisig'>;
};

export async function deployMultisig({ config, type }: Params): Promise<Safe> {
  const safeVersion = '1.4.1';

  const signer = config.deployerIsLedger
    ? undefined
    : config.deployer.privateKey;

  const safeAccountConfig: SafeAccountConfig = {
    owners: [config.deployerAddress],
    threshold: 1,
  };

  const saltNonce = hexlify(toUtf8Bytes(type));

  const predictedSafe: PredictedSafeProps = {
    safeAccountConfig,
    safeDeploymentConfig: {
      saltNonce,
      safeVersion,
    },
  };

  const protocolKit = await Safe.init({
    provider: config.rpc,
    signer,
    predictedSafe,
    contractNetworks: {
      [config.network.chainId.toString()]: config.safeAddresses,
    },
  });

  // `protocolKit.getAddress()` calculates incorrect address on zksync chains due to an `if statement` with the chainId
  const safeAddress = await predictSafeAddress({
    safeProvider: protocolKit.getSafeProvider(),
    chainId: config.networkName.toLowerCase().includes('zksync')
      ? 1n
      : config.network.chainId,
    ...predictedSafe,
    customContracts: config.safeAddresses,
  });

  console.log(`Predicted ${type} address: ${safeAddress}`);

  if (await checkAddressExists(config, safeAddress)) {
    console.log(`  -> ✅ ${type} already deployed!`);
  } else {
    console.log(`  -> ⏳ ${type} not found, deploying...`);

    const deploymentTransaction =
      await protocolKit.createSafeDeploymentTransaction();

    const feeData = await (async () => {
      try {
        console.log('Before getting fee data');
        return await config.provider.getFeeData();
      } catch {
        console.log('Failed to get fee data, using gas price fallback');
        return {
          gasPrice: BigInt(await config.provider.send('eth_gasPrice', [])),
          maxFeePerGas: null,
          maxPriorityFeePerGas: null,
        };
      }
    })();

    const txRequest: TransactionRequest = {
      chainId: config.network.chainId,
      nonce: await config.provider.getTransactionCount(config.deployerAddress),
      to: deploymentTransaction.to,
      value: 0,
      data: deploymentTransaction.data,
      ...(typeof feeData.maxFeePerGas !== 'bigint'
        ? {
            type: 0,
            gasPrice: feeData.gasPrice,
          }
        : {
            maxFeePerGas: feeData.maxFeePerGas,
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
          }),
    };

    const gasLimit = await config.provider.estimateGas(txRequest);
    txRequest.gasLimit = Number(gasLimit);

    const signedTx = await config.deployer.signTransaction(txRequest);

    const txHash = await config.provider.send('eth_sendRawTransaction', [
      signedTx,
    ]);

    const transactionReceipt = await config.provider.waitForTransaction(txHash);

    console.log('     ✅ Safe deployment tx hash:', transactionReceipt?.hash);
  }

  return protocolKit.connect({
    provider: config.rpc,
    signer,
    safeAddress,
    contractNetworks: {
      [config.network.chainId.toString()]: config.safeAddresses,
    },
  });
}
