import { Etherscan } from '@nomicfoundation/hardhat-verify/etherscan';
import { sleep } from '@nomicfoundation/hardhat-verify/internal/utilities';
import { task } from 'hardhat/config';
import deployment from '../deployments/deploymentV1.json';
import { CoreContract } from './multichain-deploy';

const etherscanUrls = {
  sepolia: {
    apiUrl: 'https://rpc.dev.buildbear.io/verify/etherscan/anetastsvetkova',
    browserUrl: 'https://explorer.dev.buildbear.io/anetastsvetkova',
    chainId: 11155111,
  },
};

task('verify', 'Verify contracts on Etherscan')
  .addParam('networks', 'The networks to verify')
  .setAction(async (args, { artifacts, run }) => {
    const networks = args.networks.split(',');

    for (const network of networks) {
      const { apiUrl, browserUrl } =
        etherscanUrls[network as keyof typeof etherscanUrls];
      const instance = new Etherscan(
        process.env.ETHERSCAN_API_KEY || '', // Etherscan API key
        apiUrl, // Etherscan API URL
        browserUrl, // Etherscan browser URL
      );

      const deploymentData = deployment[network as keyof typeof deployment];
      for (const contractName in deploymentData.contracts.coreContracts) {
        const address =
          deploymentData.contracts.coreContracts[
            contractName as keyof CoreContract
          ];
        try {
          await run('verify:verify', {
            address: address,
            constructorArguments: args,
          });
        } catch (e) {
          if (e.message.toLowerCase().includes('already verified')) {
            console.log('Already verified!');
          } else {
            console.log(e);
          }
        }
      }
    }
  });
