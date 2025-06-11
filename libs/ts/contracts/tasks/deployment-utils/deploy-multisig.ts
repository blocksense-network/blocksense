import Safe, {
  SafeAccountConfig,
  PredictedSafeProps,
} from '@safe-global/protocol-kit';
import { hexlify, toUtf8Bytes } from 'ethers';

import { NetworkConfig } from '../types';
import { checkAddressExists } from '../utils';

type Params = {
  config: NetworkConfig;
  type: keyof Pick<NetworkConfig, 'adminMultisig' | 'sequencerMultisig'>;
};

export async function deployMultisig({ config, type }: Params): Promise<Safe> {
  const safeVersion = '1.4.1';

  const signer = config[type].signer;

  const safeAccountConfig: SafeAccountConfig = {
    owners: [
      signer ? signer.address : await config.ledgerAccount!.getAddress(),
    ],
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
    signer: signer?.privateKey,
    predictedSafe,
    contractNetworks: {
      [config.network.chainId.toString()]: config.safeAddresses,
    },
  });

  const safeAddress = await protocolKit.getAddress();

  console.log(`Predicted ${type} address: ${safeAddress}`);

  if (await checkAddressExists(config, safeAddress)) {
    console.log(`  -> ✅ ${type} already deployed!`);
    return protocolKit.connect({
      provider: config.rpc,
      signer: signer?.privateKey,
      safeAddress,
      contractNetworks: {
        [config.network.chainId.toString()]: config.safeAddresses,
      },
    });
  } else {
    console.log(`  -> ⏳ ${type} not found, deploying...`);
  }

  const deploymentTransaction =
    await protocolKit.createSafeDeploymentTransaction();

  const transactionHash = await (
    signer ?? config.ledgerAccount!
  ).sendTransaction({
    to: deploymentTransaction.to,
    value: BigInt(deploymentTransaction.value),
    data: deploymentTransaction.data as `0x${string}`,
  });

  const transactionReceipt = await config.provider.waitForTransaction(
    transactionHash.hash,
  );

  console.log('    ✅ Safe deployment tx hash:', transactionReceipt?.hash);

  return protocolKit.connect({ safeAddress });
}
