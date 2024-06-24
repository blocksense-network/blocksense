import { ethers } from 'hardhat';
import { PackedEncoding, RefEncoding } from '../typechain';

const d1 = 3;
const d2 = 47386;
const d3 = ethers.encodeBytes32String('hello world'); //.slice(0, 50);

describe.only('Encodings', () => {
  describe('Reference implementation', () => {
    let encodingRef: RefEncoding;
    beforeEach(async () => {
      const RefEncoding = await ethers.getContractFactory('RefEncoding');
      encodingRef = await RefEncoding.deploy();
      await encodingRef.waitForDeployment();
    });

    it('Should measure encode gas usage', async () => {
      await testContract(encodingRef, d1, d2, d3);
    });
  });

  describe('Packed encoding', async () => {
    let encodingPacked: PackedEncoding;
    beforeEach(async () => {
      const PackedEncoding = await ethers.getContractFactory('PackedEncoding');
      encodingPacked = await PackedEncoding.deploy();
      await encodingPacked.waitForDeployment();
    });

    it('Should measure encode gas usage', async () => {
      await testContract(encodingPacked, d1, d2, d3);
    });
  });
});
const testContract = async (
  contract: RefEncoding | PackedEncoding,
  ...data: any[]
) => {
  const [d1, d2, d3] = data;
  const tx = await contract.encode(d1, d2, d3);
  const receipt = await tx.wait();
  console.log('[encode] gas used:', receipt?.gasUsed);

  const iface = contract.interface;
  const event = iface
    .decodeEventLog(
      contract.filters['Encoded(bytes)']().fragment,
      receipt?.logs[0].data!,
    )
    .getValue('data');

  const tx2 = await contract.decode(event);
  const receipt2 = await tx2.wait();
  console.log('[decode] gas used:', receipt2?.gasUsed);

  const tx3 = await contract.storeEncodedData(event);
  const receipt3 = await tx3.wait();
  console.log('[store] gas used:', receipt3?.gasUsed);

  const tx4 = await contract.decodeFromStorage();
  const receipt4 = await tx4.wait();
  console.log('[decodeFromStorage] gas used:', receipt4?.gasUsed);
};
