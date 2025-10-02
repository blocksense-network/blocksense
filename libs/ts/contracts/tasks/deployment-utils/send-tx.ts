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

  const signedTx = await config.deployer.signTransaction(txRequest);

  const txHash = await config.provider.send('eth_sendRawTransaction', [
    signedTx,
  ]);

  return config.provider.waitForTransaction(txHash);
}
