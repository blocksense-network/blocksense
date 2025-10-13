import { task } from 'hardhat/config';
import { initChain } from './deployment-utils/init-chain';
import { parseEther } from 'ethers';

task('fund-ledger', '[UTILS] Fund the ledger account with ETH').setAction(
  async (_, { ethers }) => {
    const config = await initChain('local');

    console.log('ledgerAccount', config.deployerAddress);
    console.log(
      '[BEFORE] ledger balance',
      await config.provider.getBalance(config.deployerAddress),
    );

    const tx = await (await ethers.getSigners())[0]
      .connect(config.provider)
      .sendTransaction({
        to: config.deployerAddress,
        value: parseEther('10'),
      });
    await tx.wait();

    console.log(
      '[AFTER] ledger balance',
      await config.provider.getBalance(config.deployerAddress),
    );
  },
);
