import { Signer } from 'ethers';
import {
  DataFeedStoreV1,
  DataFeedStoreV2,
  DataFeedStoreV3,
  UpgradableProxy,
  ITransparentUpgradeableProxy__factory,
} from '../typechain';
import { DataFeedStore, deployContract } from './uitls/helpers';
import { contractVersionLogger } from './uitls/logger';
import { ethers, network } from 'hardhat';
import { expect } from 'chai';

const contractsImpl: {
  [key: string]: DataFeedStore;
} = {};

describe.only('UpgradableProxy', function () {
  let logger: ReturnType<typeof contractVersionLogger>;
  let admin: Signer;
  let upgradableContractsImpl: UpgradableProxy;

  beforeEach(async function () {
    admin = (await ethers.getSigners())[9];

    contractsImpl.V1 = await deployContract<DataFeedStoreV1>('DataFeedStoreV1');
    contractsImpl.V2 = await deployContract<DataFeedStoreV2>('DataFeedStoreV2');
    contractsImpl.V3 = await deployContract<DataFeedStoreV3>('DataFeedStoreV3');

    upgradableContractsImpl = await deployContract<UpgradableProxy>(
      'UpgradableProxy',
      contractsImpl.V1.target,
      await admin.getAddress(),
    );

    logger = contractVersionLogger([contractsImpl]);
  });

  it('Should upgrade DataFeedStoreV1 to DataFeedStoreV2', async function () {
    const params: any = {};
    params.to = upgradableContractsImpl.target;
    params.from = await admin.getAddress();
    params.data = ethers.solidityPacked(
      ['bytes4', 'address'],
      [
        ITransparentUpgradeableProxy__factory.createInterface().getFunction(
          'upgradeToAndCall',
        ).selector,
        contractsImpl.V2.target,
      ],
    );

    const oldImplementationAddress =
      await upgradableContractsImpl.implementation();

    const txHash = await network.provider.send('eth_sendTransaction', [params]);

    const receipt = await network.provider.send('eth_getTransactionReceipt', [
      txHash,
    ]);

    expect(receipt.status).to.be.eq('0x1');

    const newImplementationAddress =
      await upgradableContractsImpl.implementation();

    expect(newImplementationAddress).to.be.eq(contractsImpl.V2.target);
    expect(oldImplementationAddress).to.be.eq(contractsImpl.V1.target);
  });
});
