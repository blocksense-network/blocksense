import fs from 'fs/promises';
import { task } from 'hardhat/config';
import { ChainConfig, CoreContract } from './types';
import { RunTaskFunction } from 'hardhat/types';

task('etherscan-verify', 'Verify contracts on Etherscan')
  .addParam('deploymentFile', 'Path to deployment file')
  .setAction(async (args, { run, network }) => {
    const deployment: ChainConfig = JSON.parse(
      await fs.readFile(args.deploymentFile, 'utf8'),
    );

    const chainId = network.config.chainId?.toString();
    const deploymentData = deployment[chainId as keyof typeof deployment];

    for (const contractName in deploymentData.contracts.coreContracts) {
      const data =
        deploymentData.contracts.coreContracts[
          contractName as keyof CoreContract
        ];
      console.log('-> Verifying contract:', contractName, data.address);
      await verify(data, run);
    }

    for (const data of deploymentData.contracts.ChainlinkProxy) {
      console.log('-> Verifying contract:', data.description, data.address);
      await verify(data, run);
    }
  });

const verify = async (
  data: { address: string; constructorArgs: any[] },
  run: RunTaskFunction,
) => {
  try {
    await run('verify:verify', {
      address: data.address,
      constructorArguments: data.constructorArgs,
    });
  } catch (e: any) {
    if (e.message.toLowerCase().includes('already verified')) {
      console.log('Already verified!');
    } else {
      console.log(e);
    }
  }
};
