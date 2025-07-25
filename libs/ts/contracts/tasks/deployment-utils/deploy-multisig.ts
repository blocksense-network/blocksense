import Safe, {
  SafeAccountConfig,
  PredictedSafeProps,
  predictSafeAddress,
} from '@safe-global/protocol-kit';
import { hexlify, toUtf8Bytes } from 'ethers';

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

    const transactionHash = await config.deployer.sendTransaction({
      to: deploymentTransaction.to,
      value: BigInt(deploymentTransaction.value),
      data: deploymentTransaction.data as `0x${string}`,
    });

    const transactionReceipt = await config.provider.waitForTransaction(
      transactionHash.hash,
    );

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
