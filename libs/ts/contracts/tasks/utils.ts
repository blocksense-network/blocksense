import { ethers } from 'ethers';
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
