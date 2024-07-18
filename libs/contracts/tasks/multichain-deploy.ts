import { task } from 'hardhat/config';
import Safe, {
  SafeAccountConfig,
  SafeFactory,
} from '@safe-global/protocol-kit';
import { HDNodeWallet, JsonRpcProvider, ethers } from 'ethers';
import {
  OperationType,
  SafeTransaction,
  SafeTransactionDataPartial,
} from '@safe-global/safe-core-sdk-types';
import { Artifacts } from 'hardhat/types';

interface NetworkConfig {
  rpc: string;
  provider: JsonRpcProvider;
  signer: HDNodeWallet;
  owners: HDNodeWallet[];
  safeAddresses: {
    multiSendAddress: string;
    multiSendCallOnlyAddress: string;
    createCallAddress: string;
    safeSingletonAddress: string;
    safeProxyFactoryAddress: string;
    fallbackHandlerAddress: string;
    signMessageLibAddress: string;
    simulateTxAccessorAddress: string;
  };
}

const RPC_SEPOLIA = 'https://rpc.buildbear.io/certain-ghostrider-6ad8ba7c';
const RPC_AMOY = 'https://rpc.buildbear.io/middle-husk-f5ddcb92';
const SEPOLIA_MNEMONIC =
  'climb trap document virtual interest zebra mirror tired debate sample road involve';
const AMOY_MNEMONIC =
  'climb trap document virtual interest zebra mirror tired debate sample road involve';

task('deploy', 'Deploy contracts')
  .addParam('networks', 'Network to deploy to')
  .addOptionalParam('snapshot', 'Take a snapshot before deploying')
  .addOptionalParam('revert', 'Revert to snapshot')
  .setAction(async (args, { ethers, network, artifacts }) => {
    const sepoliaConfig = await initSepolia();
    const amoyConfig = await initAmoy();

    if (args.snapshot) {
      const snapshotIdSepolia = await sepoliaConfig.provider.send(
        'evm_snapshot',
        [],
      );
      const snapshotIdAmoy = await amoyConfig.provider.send('evm_snapshot', []);
      console.log('snapshot id', snapshotIdSepolia, snapshotIdAmoy);
      return;
    }

    if (args.revert) {
      await sepoliaConfig.provider.send('evm_revert', [args.revert]);
      await amoyConfig.provider.send('evm_revert', [args.revert]);

      const snapshotIdSepolia = await sepoliaConfig.provider.send(
        'evm_snapshot',
        [],
      );
      const snapshotIdAmoy = await amoyConfig.provider.send('evm_snapshot', []);
      console.log('snapshot id', snapshotIdSepolia, snapshotIdAmoy);
      return;
    }

    console.log(
      'sepolia signer',
      sepoliaConfig.signer.address,
      await sepoliaConfig.provider.getBalance(sepoliaConfig.signer.address),
    );
    console.log(
      'amoy signer   ',
      amoyConfig.signer.address,
      await amoyConfig.provider.getBalance(amoyConfig.signer.address),
    );

    // console.log(
    //   'contract address deployed',
    //   (
    //     await sepoliaProvider.getTransactionReceipt(
    //       '0x04c0220084770933c98851ddc9c0c63f2851e11814b219345ad5a7a00d1deed7',
    //     )
    //   )?.contractAddress,
    // );

    /*
    tx hash obj 0x81d728763dfd9cf486d6899f594669322ab46175f8f482d8d6fbfd3335e31fae
    tx hash 0xc572d3504576704c4cc0d08659af70ec903e1ecbf672320a814cdf00861d1cce */
    // const trace = await sepoliaConfig.provider.send('debug_tracetransaction', [
    //   '0xc572d3504576704c4cc0d08659af70ec903e1ecbf672320a814cdf00861d1cce',
    // ]);

    const sepoliaMultisig = await deployMultisig(sepoliaConfig, 1);

    const amoyMultisig = await deployMultisig(amoyConfig, 1);

    console.log('sepolia multisig', await sepoliaMultisig.getAddress());
    console.log('amoy multisig', await amoyMultisig.getAddress());

    // const implementationArtifact = artifacts.readArtifactSync(
    //   'HistoricDataFeedStoreV2',
    // );

    // const ImplementationFactorySepolia = new ethers.ContractFactory(
    //   implementationArtifact.abi,
    //   implementationArtifact.bytecode,
    //   sepoliaConfig.signer,
    // );
    // const deployTx = await ImplementationFactorySepolia.getDeployTransaction(
    //   await sepoliaMultisig.getAddress(),
    // );
    // await deployHistoric(deployTx.data, sepoliaConfig, sepoliaMultisig);

    // const ImplementationFactoryAmoy = new ethers.ContractFactory(
    //   implementationArtifact.abi,
    //   implementationArtifact.bytecode,
    //   amoyConfig.signer,
    // );
    // const deployTxAmoy = await ImplementationFactoryAmoy.getDeployTransaction(
    //   await amoyMultisig.getAddress(),
    // );
    // await deployHistoric(deployTxAmoy.data, amoyConfig, amoyMultisig);

    await ownerDeployHistoric(
      artifacts,
      sepoliaConfig,
      await sepoliaMultisig.getAddress(),
    );
    await ownerDeployHistoric(
      artifacts,
      amoyConfig,
      await amoyMultisig.getAddress(),
    );
  });

const deployMultisig = async (config: NetworkConfig, threshold: number) => {
  const safeVersion = '1.4.1';

  // Create SafeFactory instance
  const safeFactory = await SafeFactory.init({
    provider: config.rpc,
    signer: config.signer.privateKey,
    safeVersion,
    contractNetworks: {
      [config.provider._network.chainId.toString()]: {
        multiSendAddress: '0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526',
        multiSendCallOnlyAddress: '0x9641d764fc13c8B624c04430C7356C1C7C8102e2',
        createCallAddress: '0x9b35Af71d77eaf8d7e40252370304687390A1A52',
        safeSingletonAddress: '0x41675C099F32341bf84BFc5382aF534df5C7461a',
        safeProxyFactoryAddress: '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67',
        fallbackHandlerAddress: '0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99',
        signMessageLibAddress: '0xd53cd0aB83D845Ac265BE939c57F53AD838012c9',
        simulateTxAccessorAddress: '0x3d4BA2E0884aa488718476ca2FB8Efc291A46199',
      },
    },
  });

  console.log('SafeFactory address:', await safeFactory.getAddress());

  const safeAccountConfig: SafeAccountConfig = {
    owners: config.owners.map(owner => owner.address),
    threshold: threshold,
  };
  const saltNonce = '150000';

  // Predict deployed address
  const predictedDeploySafeAddress = await safeFactory.predictSafeAddress(
    safeAccountConfig,
    saltNonce,
  );

  console.log('Predicted deployed Safe address:', predictedDeploySafeAddress);

  function callback(txHash: string) {
    console.log('Transaction hash:', txHash);
  }

  // Deploy Safe
  return safeFactory.deploySafe({
    safeAccountConfig,
    saltNonce,
    callback,
  });

  // return Safe.init({
  //   provider: config.rpc,
  //   signer: config.signer.privateKey,
  //   predictedSafe: {
  //     safeAccountConfig: {
  //       owners: config.owners.map(owner => owner.address),
  //       threshold,
  //     },
  //   },
  //   contractNetworks: {
  //     [config.provider._network.chainId.toString()]: {
  //       multiSendAddress: '0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526',
  //       multiSendCallOnlyAddress: '0x9641d764fc13c8B624c04430C7356C1C7C8102e2',
  //       createCallAddress: '0x9b35Af71d77eaf8d7e40252370304687390A1A52',
  //       safeSingletonAddress: '0x41675C099F32341bf84BFc5382aF534df5C7461a',
  //       safeProxyFactoryAddress: '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67',
  //       fallbackHandlerAddress: '0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99',
  //       signMessageLibAddress: '0xd53cd0aB83D845Ac265BE939c57F53AD838012c9',
  //       simulateTxAccessorAddress: '0x3d4BA2E0884aa488718476ca2FB8Efc291A46199',
  //     },
  //   },
  // });
};

const initSepolia = async (): Promise<NetworkConfig> => {
  const provider = new ethers.JsonRpcProvider(RPC_SEPOLIA);
  const wallet = ethers.Wallet.fromPhrase(SEPOLIA_MNEMONIC, provider);

  return {
    rpc: RPC_SEPOLIA,
    provider,
    signer: wallet,
    owners: [wallet.deriveChild(0).connect(provider), wallet],
    safeAddresses: {
      multiSendAddress: '0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526',
      multiSendCallOnlyAddress: '0x9641d764fc13c8B624c04430C7356C1C7C8102e2',
      createCallAddress: '0x9b35Af71d77eaf8d7e40252370304687390A1A52',
      safeSingletonAddress: '0x41675C099F32341bf84BFc5382aF534df5C7461a',
      safeProxyFactoryAddress: '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67',
      fallbackHandlerAddress: '0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99',
      signMessageLibAddress: '0xd53cd0aB83D845Ac265BE939c57F53AD838012c9',
      simulateTxAccessorAddress: '0x3d4BA2E0884aa488718476ca2FB8Efc291A46199',
    },
  };
};

const initAmoy = async (): Promise<NetworkConfig> => {
  const provider = new ethers.JsonRpcProvider(RPC_AMOY);
  const wallet = ethers.Wallet.fromPhrase(AMOY_MNEMONIC, provider);

  return {
    rpc: RPC_AMOY,
    provider,
    signer: wallet,
    owners: [wallet.deriveChild(0).connect(provider), wallet],
    safeAddresses: {
      multiSendAddress: '0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526',
      multiSendCallOnlyAddress: '0x9641d764fc13c8B624c04430C7356C1C7C8102e2',
      createCallAddress: '0x9b35Af71d77eaf8d7e40252370304687390A1A52',
      safeSingletonAddress: '0x41675C099F32341bf84BFc5382aF534df5C7461a',
      safeProxyFactoryAddress: '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67',
      fallbackHandlerAddress: '0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99',
      signMessageLibAddress: '0xd53cd0aB83D845Ac265BE939c57F53AD838012c9',
      simulateTxAccessorAddress: '0x3d4BA2E0884aa488718476ca2FB8Efc291A46199',
    },
  };
};

const deploySameAddress = async (
  artifacts: Artifacts,
  sepoliaConfig: NetworkConfig,
  amoyConfig: NetworkConfig,
) => {
  const proxyArtifact = artifacts.readArtifactSync('UpgradeableProxy');
  const implementationArtifact = artifacts.readArtifactSync(
    'HistoricDataFeedStoreV2',
  );

  const ImplementationFactorySepolia = new ethers.ContractFactory(
    implementationArtifact.abi,
    implementationArtifact.bytecode,
    sepoliaConfig.signer,
  );

  const deployTx = await ImplementationFactorySepolia.getDeployTransaction(
    sepoliaConfig.signer.address,
  );
  deployTx.nonce = await sepoliaConfig.provider.getTransactionCount(
    sepoliaConfig.signer.address,
  );

  const tx1 = await sepoliaConfig.signer.sendTransaction(deployTx);
  console.log('v1 contract address', (await tx1.wait())?.contractAddress);

  console.log(await tx1.wait());
};

const deployHistoric = async (
  data: string,
  config: NetworkConfig,
  safe: Safe,
) => {
  const safeTransactionData: SafeTransactionDataPartial = {
    to: '0x0000000000000000000000000000000000000000', // should be create2 address for contract
    value: '0',
    data,
    operation: OperationType.DelegateCall,
  };
  const tx: SafeTransaction = await safe.createTransaction({
    transactions: [safeTransactionData],
  });
  const safeTxHash: string = await safe.getTransactionHash(tx);

  const senderSignature = await safe.signTransaction(tx);

  console.log('Proposing transaction:');
  console.log('  - network:', await config.provider.getNetwork());
  console.log(`  - safeTxHash: ${safeTxHash}`);
  console.log('  - signature:', senderSignature.data.to);

  const txResponse = await safe.executeTransaction(senderSignature);
  // console.log('tx', txResponse.transactionResponse);

  console.log('tx hash obj', safeTxHash);
  console.log('tx hash', txResponse.hash);

  console.log(
    'tx receipt',
    await config.provider.getTransactionReceipt(txResponse.hash),
    await config.provider.getTransaction(txResponse.hash),
  );

  // await multisig.kit.proposeTransaction({
  //   safeAddress: await multisig.safe.getAddress(),
  //   safeTransactionData: tx.data,
  //   safeTxHash,
  //   senderAddress: config.signer.address,
  //   senderSignature: senderSignature.data.data,
  // });
};

const ownerDeployHistoric = async (
  artifacts: Artifacts,
  config: NetworkConfig,
  safeAddress: string,
) => {
  const implementationArtifact = artifacts.readArtifactSync(
    'HistoricDataFeedStoreV2',
  );

  const ImplementationFactorySepolia = new ethers.ContractFactory(
    implementationArtifact.abi,
    implementationArtifact.bytecode,
    config.signer,
  );
  let deployTx =
    await ImplementationFactorySepolia.getDeployTransaction(safeAddress);

  deployTx.nonce = await config.provider.getTransactionCount(
    config.signer.address,
  );
  const tx1 = await config.signer.sendTransaction(deployTx);
  const implementationAddress = (await tx1.wait())?.contractAddress;
  console.log('-> contract address', implementationAddress);

  const proxyArtifact = artifacts.readArtifactSync('UpgradeableProxy');
  const proxyFactory = new ethers.ContractFactory(
    proxyArtifact.abi,
    proxyArtifact.bytecode,
    config.signer,
  );

  deployTx = await proxyFactory.getDeployTransaction(
    implementationAddress,
    safeAddress,
  );

  deployTx.nonce = await config.provider.getTransactionCount(
    config.signer.address,
  );

  const tx2 = await config.signer.sendTransaction(deployTx);
  const proxyAddress = (await tx2.wait())?.contractAddress;
  console.log('-> proxy address', proxyAddress);
};
