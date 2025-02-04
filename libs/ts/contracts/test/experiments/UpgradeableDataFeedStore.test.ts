import { Wallet } from 'ethers';
import { ethers } from 'hardhat';
import {
  deployContract,
  GenericHistoricalDataFeedStore,
  HistoricalDataFeedStore,
  initWrappers,
  logTable,
} from '../utils/helpers/common';
import {
  UpgradeableProxyHistoricalBaseWrapper,
  UpgradeableProxyHistoricalDataFeedStoreGenericV1Wrapper,
  UpgradeableProxyHistoricalDataFeedStoreV2Wrapper,
} from '../utils/wrappers';
import {
  HistoricalDataFeedStoreV2,
  OnlySequencersGuard,
  UpgradeableProxy,
} from '../../typechain';
import { parseEthereumAddress } from '@blocksense/base-utils';
import Safe, {
  SafeAccountConfig,
  SafeFactory,
} from '@safe-global/protocol-kit';
import {
  OperationType,
  SafeTransaction,
  SafeTransactionDataPartial,
} from '@safe-global/safe-core-sdk-types';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

const safeAddresses = {
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
};

const sequencerMultisigOwnerPKs = [
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
  '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
  '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
  '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba',
  '0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e',
];
const sequencerPK =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const adminOwnerPKs = [
  '0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97',
  '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6',
  '0xf214f2b2cd398c806f84e317254e0f0b801d0643303237d97a22a48e01628897',
];
const adminPK =
  '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356';

describe.only('UpgradeableProxy', function () {
  this.timeout(10000000);
  describe('Compare gas usage for historical contracts', function () {
    let historicalContractWrappers: UpgradeableProxyHistoricalBaseWrapper<HistoricalDataFeedStore>[] =
      [];
    let historicalContractGenericWrappers: UpgradeableProxyHistoricalBaseWrapper<GenericHistoricalDataFeedStore>[] =
      [];
    let UHSafe: UpgradeableProxy;
    let sequencerMultisigOwners: Wallet[];
    let adminMultisigOwners: Wallet[];
    let sequencerMultisigConfig: any;
    let adminMultisigConfig: any;
    let admin: HardhatEthersSigner;
    let sequencerMultisig: Safe;
    let adminMultisig: Safe;

    beforeEach(async function () {
      admin = (await ethers.getSigners())[9];
      historicalContractWrappers = [];
      historicalContractGenericWrappers = [];

      await initWrappers(
        historicalContractWrappers,
        [
          // UpgradeableProxyHistoricalDataFeedStoreV1Wrapper,
          UpgradeableProxyHistoricalDataFeedStoreV2Wrapper,
        ],
        ...Array(1).fill([await admin.getAddress()]),
      );

      await initWrappers(
        historicalContractGenericWrappers,
        [UpgradeableProxyHistoricalDataFeedStoreGenericV1Wrapper],
        ...Array(1).fill([await admin.getAddress()]),
      );

      const localhostRPC = 'http://127.0.0.1:8545';
      const provider = new ethers.JsonRpcProvider(localhostRPC);
      sequencerMultisigOwners = sequencerMultisigOwnerPKs.map(
        address => new ethers.Wallet(address, provider),
      );
      const sequencer = new ethers.Wallet(sequencerPK, provider);
      sequencerMultisigConfig = {
        rpc: localhostRPC,
        provider,
        network: await provider.getNetwork(),
        signer: sequencer,
        owners: [
          ...sequencerMultisigOwners.map(signer => signer.address),
          sequencer.address,
        ],
        threshold: 6,
      };

      adminMultisigOwners = adminOwnerPKs.map(
        address => new ethers.Wallet(address, provider),
      );
      const adminSigner = new ethers.Wallet(adminPK, provider);
      adminMultisigConfig = {
        rpc: localhostRPC,
        provider,
        network: await provider.getNetwork(),
        signer: adminSigner,
        owners: [
          ...adminMultisigOwners.map(signer => signer.address),
          adminSigner.address,
        ],
        threshold: 3,
      };

      sequencerMultisig = await deployMultisig(
        sequencerMultisigConfig,
        'sequencer',
      );
      const sequencerMultisigAddress = await sequencerMultisig.getAddress();

      adminMultisig = await deployMultisig(adminMultisigConfig, 'admin');
      const adminMultisigAddress = await adminMultisig.getAddress();

      const historical = await deployContract<HistoricalDataFeedStoreV2>(
        'HistoricalDataFeedStoreV2',
        sequencerMultisigAddress,
      );
      UHSafe = await deployContract<UpgradeableProxy>(
        'UpgradeableProxy',
        historical.target,
        await admin.getAddress(),
      );

      //////////////////////////
      // Only Sequencer Guard //
      //////////////////////////

      const guard = await deployContract<OnlySequencersGuard>(
        'OnlySequencersGuard',
        sequencerMultisigAddress,
        adminMultisigAddress,
      );
      const safeTransactionData: SafeTransactionDataPartial = {
        to: guard.target.toString(),
        value: '0',
        data: guard.interface.encodeFunctionData('setSequencer', [
          sequencer.address,
          true,
        ]),
        operation: OperationType.Call,
      };
      let setSequencerTx = await sequencerMultisig.createTransaction({
        transactions: [safeTransactionData],
      });
      setSequencerTx = await signTxWithOwners(
        adminMultisigAddress,
        setSequencerTx,
        adminOwnerPKs,
        adminMultisigConfig,
      );
      const res = await adminMultisig.executeTransaction(setSequencerTx);
      await (res.transactionResponse as any).wait();

      const tx = await sequencerMultisig.createEnableGuardTx(
        guard.target.toString(),
      );
      let safeTransaction = tx; //await sequencerMultisig.signTransaction(safeTx);

      safeTransaction = await signTxWithOwners(
        sequencerMultisigAddress,
        safeTransaction,
        sequencerMultisigOwnerPKs,
        sequencerMultisigConfig,
      );

      const txResponse =
        await sequencerMultisig.executeTransaction(safeTransaction);
      await (txResponse.transactionResponse as any).wait();
    });

    const i = 10;
    it(`Should set ${i} feeds in a single transaction`, async function () {
      const keys = Array.from({ length: i }, (_, i) => i);
      const values = keys.map(key =>
        ethers.encodeBytes32String(`Hello, World! ${key}`),
      );

      const receipts = [];

      receipts.push(await historicalContractWrappers[0].setFeeds(keys, values));
      console.log('historical v2 set');

      const receiptsGeneric = [];
      for (const contract of historicalContractGenericWrappers) {
        receiptsGeneric.push(await contract.setFeeds(keys, values));
      }
      console.log('generic set');

      //// SAFE

      const encodedData = ethers.solidityPacked(
        ['bytes4', ...keys.map(() => ['uint32', 'bytes32']).flat()],
        ['0x1a2d80ac', ...keys.flatMap((key, i) => [key, values[i]])],
      );
      const safeTx: SafeTransaction = await sequencerMultisig.createTransaction(
        {
          transactions: [
            {
              to: UHSafe.target.toString(),
              value: '0',
              data: encodedData,
              operation: OperationType.Call,
            },
          ],
        },
      );
      console.log('Tx created');

      let safeTransaction = safeTx; //await sequencerMultisig.signTransaction(safeTx);
      const safeAddress = await sequencerMultisig.getAddress();

      // sign with other sequencerMultisigOwners
      safeTransaction = await signTxWithOwners(
        safeAddress,
        safeTransaction,
        sequencerMultisigOwnerPKs,
        sequencerMultisigConfig,
      );

      console.log('\nProposing transaction...');

      // sign with a non-sequencer (`sequencer` is considered a sequencer)
      // const apiKit = await Safe.init({
      //   provider: sequencerMultisigConfig.rpc,
      //   safeAddress: safeAddress,
      //   signer:
      //     '0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e',
      //   contractNetworks: {
      //     [sequencerMultisigConfig.network.chainId.toString()]: sequencerMultisigConfig.safeAddresses,
      //   },
      // });

      // the signer executing the transaction doesn't need to sign it
      // their signature is counted from msg.sender
      const txResponse =
        await sequencerMultisig.executeTransaction(safeTransaction);

      // transactionResponse is of unknown type and there is no type def in the specs
      await (txResponse.transactionResponse as any).wait();
      receipts.push(
        await ethers.provider.getTransactionReceipt(txResponse.hash),
      );
      ////

      const map: Record<string, string> = {};
      for (const wrapper of [
        ...historicalContractGenericWrappers,
        ...historicalContractWrappers,
      ]) {
        map[wrapper.contract.target.toString()] = wrapper.getName();
      }
      map[await sequencerMultisig.getAddress()] =
        'UpgradeableHistoricalV2<Safe>';

      await logTable(map, receipts, receiptsGeneric);
    });
  });
});

const deployMultisig = async (config: any, salt: string) => {
  const safeFactory = await SafeFactory.init({
    provider: config.rpc,
    signer: config.signer.privateKey,
    safeVersion: '1.4.1',
    contractNetworks: {
      [config.network.chainId.toString()]: safeAddresses,
    },
  });

  const safeAccountConfig: SafeAccountConfig = {
    owners: config.owners,
    threshold: config.threshold,
  };

  return safeFactory.deploySafe({
    safeAccountConfig,
    saltNonce: ethers.id(salt),
    options: {
      nonce: await config.provider.getTransactionCount(config.signer.address),
    },
    callback: (txHash: string) => {
      console.log('-> Safe deployment tx hash:', txHash);
    },
  });
};

const signTxWithOwners = async (
  multisigAddress: string,
  safeTransaction: SafeTransaction,
  ownerPKs: string[],
  config: any,
) => {
  for (const owner of ownerPKs) {
    const apiKit = await Safe.init({
      provider: config.rpc,
      safeAddress: multisigAddress,
      signer: owner,
      contractNetworks: {
        [config.network.chainId.toString()]: safeAddresses,
      },
    });
    safeTransaction = await apiKit.signTransaction(safeTransaction);
  }

  return safeTransaction;
};
