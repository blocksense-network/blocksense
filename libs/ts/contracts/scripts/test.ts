import fs from 'fs';
import { ethers } from 'ethers';

(async () => {
  const args = process.argv.slice(2);
  const rpc = 'https://polaris1.ont.io:10339/';
  const provider = new ethers.JsonRpcProvider(rpc);

  const privKey = await fs.promises.readFile(args[0], 'utf-8');
  const sequencer = new ethers.Wallet(privKey.replace('\n', ''), provider);
  const blockNumber = 3517579804n;
  const txData = {
    to: '0xadf5aadbe080819209bf641fdf03748bb495c6f3',
    data:
      '0x01' +
      ethers.toBeHex(blockNumber).replace('0x', '') +
      '0000000200010101200000000000000000000000000000000000000a2aa89c270d00000199800c16e00002200101200000000000000000000000000000000000000a2a6957b6cd00000199800c16e001000000000000000000000000000000000000000000000000000000000000000000',
  };

  const estimatedGas = await sequencer.connect(provider).estimateGas(txData);
  console.log('estimatedGas', estimatedGas);
  const tx = await sequencer.connect(provider).sendTransaction({
    ...txData,
    gasLimit: estimatedGas,
  });

  console.log('tx', tx);
  const receipt = await tx.wait();
  console.log('receipt', receipt);
})();
