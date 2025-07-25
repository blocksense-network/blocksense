import { getCreate2Address, keccak256, solidityPacked } from 'ethers';
import { ContractNames, NetworkConfig } from './types';
import { Artifacts } from 'hardhat/types';

export async function checkAddressExists(
  config: NetworkConfig,
  address: string,
): Promise<boolean> {
  const result = await config.provider.getCode(address);
  return result !== '0x';
}

export const awaitTimeout = (delayMs: number, reason: string) =>
  new Promise<undefined>((resolve, reject) =>
    setTimeout(
      () => (reason === undefined ? resolve(undefined) : reject(reason)),
      delayMs,
    ),
  );

export const predictAddress = async (
  artifacts: Artifacts,
  config: NetworkConfig,
  contractName: ContractNames,
  salt: string,
  args: string,
) => {
  const artifact = artifacts.readArtifactSync(contractName);
  const bytecode = solidityPacked(
    ['bytes', 'bytes'],
    [artifact.bytecode, args],
  );

  return getCreate2Address(
    config.safeAddresses.createCallAddress,
    salt,
    keccak256(bytecode),
  );
};

export const adjustVInSignature = async (
  signature: string,
): Promise<string> => {
  const ETHEREUM_V_VALUES = [0, 1, 27, 28];
  const MIN_VALID_V_VALUE_FOR_SAFE_ECDSA = 27;
  let signatureV = parseInt(signature.slice(-2), 16);
  if (!ETHEREUM_V_VALUES.includes(signatureV)) {
    throw new Error('Invalid signature');
  }

  if (signatureV < MIN_VALID_V_VALUE_FOR_SAFE_ECDSA) {
    signatureV += MIN_VALID_V_VALUE_FOR_SAFE_ECDSA;
  }
  signatureV += 4;
  signature = signature.slice(0, -2) + signatureV.toString(16);
  return signature;
};
