import { getCreate2Address, keccak256, solidityPacked } from 'ethers';
import { ContractNames, NetworkConfig } from './types';
import { Artifacts } from 'hardhat/types';
import {
  getOptionalApiKey,
  networkMetadata,
  NetworkName,
  fromEntries,
  keysOf,
  entriesOf,
} from '@blocksense/base-utils';

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

export const getCustomChainConfig = (explorerIndex: number) =>
  entriesOf(networkMetadata)
    .filter(([_, meta]) => meta.explorers[explorerIndex]?.apiUrl)
    .map(([name, meta]) => {
      const explorer = meta.explorers[explorerIndex];
      return {
        network: name,
        chainId: meta.chainId,
        urls: {
          apiURL: explorer.apiUrl!,
          browserURL: explorer.webUrl,
        },
      };
    });

export const getApiKeys = () =>
  fromEntries(
    keysOf(networkMetadata).map(name => [
      name,
      getOptionalApiKey(name as NetworkName),
    ]),
  );

export const binarySearch = <T>(
  array: T[],
  left: number,
  right: number,
  condition: (mid: T, index: number) => boolean,
): number => {
  while (left < right) {
    const midIndex = Math.floor((left + right) / 2);
    const midValue = array[midIndex];

    if (condition(midValue, midIndex)) {
      left = midIndex + 1;
    } else {
      right = midIndex;
    }
  }
  return left;
};
