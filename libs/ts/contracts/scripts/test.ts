import { ethers } from 'hardhat';

// example usage
(async () => {
  try {
    const rpc = 'http://localhost:8500';
    const adfs = '0xadf5aadbe080819209bf641fdf03748bb495c6f3';

    const provider = new ethers.JsonRpcProvider(rpc);

    const prefix = ethers.solidityPacked(
      ['bytes1', 'uint8', 'uint120'],
      [ethers.toBeHex(0x84), '4', '0'],
    );

    const res = await provider.call({
      to: adfs,
      data: prefix,
    });

    console.log('res', res);

    process.exit(0);
  } catch (e: any) {
    console.log(e.message);
    process.exit(1);
  }
})();
