import { parseEthereumAddress } from '@blocksense/base-utils';
import Safe, {
  SafeAccountConfig,
  SafeFactory,
} from '@safe-global/protocol-kit';
import { ethers } from 'ethers';
import { HistoricalDataFeedStoreV2, UpgradeableProxy } from '../typechain';
import { deployContract } from '../test/utils/helpers/common';
import {
  OperationType,
  SafeTransaction,
} from '@safe-global/safe-core-sdk-types';

(async () => {
  const localhostRPC = 'http://127.0.0.1:8545';
  const provider = new ethers.JsonRpcProvider(localhostRPC);

  const owners = [
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
    '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
    '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
    '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
    '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba',
    '0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e',
  ].map(privateKey => new ethers.Wallet(privateKey, provider));

  const config = {
    rpc: localhostRPC,
    provider,
    network: await provider.getNetwork(),
    signer: owners[0],
    owners: owners.map(owner => owner.address),
    safeAddresses: {
      multiSendAddress: parseEthereumAddress(
        '0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526',
      ),
      multiSendCallOnlyAddress: parseEthereumAddress(
        '0x9641d764fc13c8B624c04430C7356C1C7C8102e2',
      ),
      createCallAddress: parseEthereumAddress(
        '0x9b35Af71d77eaf8d7e40252370304687390A1A52',
      ),
      safeSingletonAddress: parseEthereumAddress(
        '0x41675C099F32341bf84BFc5382aF534df5C7461a',
      ),
      safeProxyFactoryAddress: parseEthereumAddress(
        '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67',
      ),
      fallbackHandlerAddress: parseEthereumAddress(
        '0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99',
      ),
      signMessageLibAddress: parseEthereumAddress(
        '0xd53cd0aB83D845Ac265BE939c57F53AD838012c9',
      ),
      simulateTxAccessorAddress: parseEthereumAddress(
        '0x3d4BA2E0884aa488718476ca2FB8Efc291A46199',
      ),
      safeWebAuthnSharedSignerAddress: parseEthereumAddress(
        // https://github.com/safe-global/safe-modules-deployments/blob/v2.2.4/src/assets/safe-passkey-module/v0.2.1/safe-webauthn-shared-signer.json#L6gs
        '0x94a4F6affBd8975951142c3999aEAB7ecee555c2',
      ),
      safeWebAuthnSignerFactoryAddress: parseEthereumAddress(
        // https://github.com/safe-global/safe-modules-deployments/blob/v2.2.4/src/assets/safe-passkey-module/v0.2.1/safe-webauthn-signer-factory.json#L6
        '0x1d31F259eE307358a26dFb23EB365939E8641195',
      ),
    },
    threshold: 7,
  };

  const safeVersion = '1.4.1';

  const safeFactory = await SafeFactory.init({
    provider: config.rpc,
    signer: config.signer.privateKey,
    safeVersion,
    contractNetworks: {
      [config.network.chainId.toString()]: config.safeAddresses,
    },
  });

  const safeAccountConfig: SafeAccountConfig = {
    owners: config.owners,
    threshold: config.threshold,
  };

  const salt =
    '0xf59f61ec45fbbf18cb29f003791817c64726e6617d681fa7e2b70ba3a1a8a283';

  const multisig = await safeFactory.deploySafe({
    safeAccountConfig,
    saltNonce: salt,
    options: {
      nonce: await config.provider.getTransactionCount(config.signer.address),
    },
    callback: (txHash: string) => {
      console.log('-> Safe deployment tx hash:', txHash);
    },
  });

  const multisigAddress = await multisig.getAddress();

  console.log('Safe address:', multisigAddress);

  const admin = new ethers.Wallet(
    '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356',
    provider,
  );

  const historical = await deployContract<HistoricalDataFeedStoreV2>(
    'HistoricalDataFeedStoreV2',
    multisigAddress,
  );

  const UHSafe = await deployContract<UpgradeableProxy>(
    'UpgradeableProxy',
    historical.target,
    await admin.getAddress(),
  );

  console.log('Upgradable proxy address', UHSafe.target.toString());

  const keys = Array.from({ length: 1 }, (_, i) => i);
  const values = keys.map(key =>
    ethers.encodeBytes32String(`Hello, World! ${key}`),
  );

  const encodedData = ethers.solidityPacked(
    ['bytes4', ...keys.map(() => ['uint32', 'bytes32']).flat()],
    ['0x1a2d80ac', ...keys.flatMap((key, i) => [key, values[i]])],
  );

  console.log('Encoded data:', encodedData);

  let safeTx: SafeTransaction = await multisig.createTransaction({
    transactions: [
      {
        to: UHSafe.target.toString(),
        value: '0',
        data: encodedData,
        operation: OperationType.Call,
      },
    ],
  });

  for (const owner of owners) {
    const apiKit = await Safe.init({
      provider: config.rpc,
      safeAddress: multisigAddress,
      signer: owner.privateKey,
      contractNetworks: {
        [config.network.chainId.toString()]: config.safeAddresses,
      },
    });

    safeTx = await apiKit.signTransaction(safeTx);
  }

  const txResponse = await multisig.executeTransaction(safeTx);

  await (txResponse.transactionResponse as any).wait();
})();
