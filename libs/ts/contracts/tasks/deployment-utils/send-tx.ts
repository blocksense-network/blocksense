import { FeeData, TransactionReceipt, TransactionRequest } from 'ethers';

import { NetworkConfig } from '../types';

type Params = {
  config: NetworkConfig;
  to: string;
  data: string;
  value?: bigint;
};

export async function sendTx({
  config,
  to,
  data,
  value = 0n,
}: Params): Promise<TransactionReceipt | null> {
  let feeData: Pick<
    FeeData,
    'gasPrice' | 'maxFeePerGas' | 'maxPriorityFeePerGas'
  >;
  try {
    feeData = await config.provider.getFeeData();
  } catch {
    feeData = {
      gasPrice: BigInt(await config.provider.send('eth_gasPrice', [])),
      maxFeePerGas: null,
      maxPriorityFeePerGas: null,
    };
  }

  const txRequest: TransactionRequest = {
    chainId: config.network.chainId,
    nonce: await config.provider.getTransactionCount(config.deployerAddress),
    to,
    value,
    data,
    ...(feeData.maxFeePerGas == null
      ? {
          type: 0,
          gasPrice: feeData.gasPrice,
        }
      : {
          maxFeePerGas: feeData.maxFeePerGas,
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        }),
  };
  if (config.txGasLimit === 'auto') {
    const gasLimit = await config.provider.estimateGas(txRequest);
    txRequest.gasLimit = gasLimit;
  } else {
    txRequest.gasLimit = config.txGasLimit;
  }

  const tx = await config.deployer.sendTransaction(txRequest);

  // On some networks, `tx.wait()` is not enough to ensure the transaction is mined.
  // On others, `waitForTransaction` is not enough.
  // We use both to ensure the transaction is mined.
  // These measures are taken to avoid `nonce too low` errors in subsequent transactions
  // mainly for local deployments and rarely on some chains.
  await config.provider.waitForTransaction(tx.hash);
  await tx.wait();
  return config.provider.getTransactionReceipt(tx.hash);
}
