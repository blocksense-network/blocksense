import { task } from 'hardhat/config';
import { NetworkConfig } from './types';

task('fund-ledger', '[UTILS] Fund the ledger account with ETH').setAction(
  async (args, { ethers }) => {
    const {
      config,
    }: {
      config: NetworkConfig;
    } = args;

    console.log('ledgerAccount', config.deployerAddress);
    console.log(
      '[BEFORE] ledger balance',
      await config.provider.getBalance(config.deployerAddress),
    );

    const tx = await (await ethers.getSigners())[0]
      .connect(config.provider)
      .sendTransaction({
        to: config.deployerAddress,
        value: ethers.parseEther('10'),
      });
    await tx.wait();

    console.log(
      '[AFTER] ledger balance',
      await config.provider.getBalance(config.deployerAddress),
    );
  },
);
