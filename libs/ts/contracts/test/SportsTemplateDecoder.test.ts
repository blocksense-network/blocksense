import { expect } from 'chai';
import { ethers } from 'hardhat';
import fs from 'fs';
import path from 'path';
import ejs from 'ejs';
import { run } from 'hardhat';

interface Field {
  name: string;
  type: string;
  size: number;
}

describe('Decoder', () => {
  const templatePath = path.join(__dirname, '../templates/decoder.sol.ejs');
  const tempFilePath = path.join(__dirname, '../contracts/UserDecoder.sol');

  async function generateAndDeployDecoder(
    fields: { name: string; type: string; size: number }[],
  ) {
    const template = fs.readFileSync(templatePath, 'utf-8');
    const generatedCode = ejs.render(template, { fields });
    fs.writeFileSync(tempFilePath, generatedCode, 'utf-8');

    await run('compile');

    const DecoderFactory = await ethers.getContractFactory('Decoder');
    return await DecoderFactory.deploy();
  }

  async function testDecoder(fields: Field[], values: any[]) {
    const decoder = await generateAndDeployDecoder(fields);
    const packedData = ethers.solidityPacked(
      fields.map(field => field.type),
      values,
    );
    const result: any = await decoder.decode(packedData);
    expect(result).to.deep.equal(values);
  }

  it('should correctly decode packed sports data with boolean fields', async () => {
    const fields = [
      { name: 'isHomeTeam', type: 'bool', size: 8 },
      { name: 'isOvertime', type: 'bool', size: 8 },
      { name: 'score', type: 'uint16', size: 16 },
    ];
    const values = [true, false, 100];
    await testDecoder(fields, values);
  });

  it('should correctly decode packed sports data with mixed field types and sizes', async () => {
    const fields = [
      { name: 'gameId', type: 'uint32', size: 32 },
      { name: 'teamName', type: 'bytes32', size: 256 },
      { name: 'playerCount', type: 'uint8', size: 8 },
    ];
    const values = [12345, ethers.encodeBytes32String('TeamA'), 11];
    await testDecoder(fields, values);
  });

  it('should handle maximum values for each field type', async () => {
    const fields = [
      { name: 'maxUint8', type: 'uint8', size: 8 },
      { name: 'maxUint16', type: 'uint16', size: 16 },
      { name: 'maxUint32', type: 'uint32', size: 32 },
      { name: 'maxUint64', type: 'uint64', size: 64 },
    ];
    const values = [255, 65535, 4294967295, BigInt('18446744073709551615')];
    await testDecoder(fields, values);
  });

  it('should handle mixed field types and sizes', async () => {
    const fields = [
      { name: 'isOvertime', type: 'bool', size: 8 },
      { name: 'isFinal', type: 'bool', size: 8 },
      { name: 'homeScore', type: 'uint16', size: 16 },
      { name: 'awayScore', type: 'uint16', size: 16 },
    ];
    const values = [true, false, 110, 108];
    await testDecoder(fields, values);
  });

  it('should correctly decode packed sports data with maximum values', async () => {
    const fields = [
      { name: 'maxUint8', type: 'uint8', size: 8 },
      { name: 'maxUint16', type: 'uint16', size: 16 },
      { name: 'maxUint32', type: 'uint32', size: 32 },
    ];
    const values = [255, 65535, 4294967295];
    await testDecoder(fields, values);
  });

  it('should handle different int sizes and address', async () => {
    const fields = [
      { name: 'int8Value', type: 'int8', size: 8 },
      { name: 'int16Value', type: 'int16', size: 16 },
      { name: 'int32Value', type: 'int32', size: 32 },
      { name: 'int64Value', type: 'int64', size: 64 },
      { name: 'addressValue', type: 'address', size: 160 },
    ];
    const values = [
      -128,
      -32768,
      -2147483648,
      BigInt('-9223372036854775808'),
      '0x1234567890123456789012345678901234567890',
    ];
    await testDecoder(fields, values);
  });

  it('should handle different bytes sizes', async () => {
    const fields = [
      { name: 'bytes1Value', type: 'bytes1', size: 8 },
      { name: 'bytes16Value', type: 'bytes16', size: 128 },
      { name: 'bytes32Value', type: 'bytes32', size: 256 },
    ];
    const values = [
      '0xff',
      '0x1234567890abcdef1234567890abcdef',
      '0x1234567890123456789012345678901234567890123456789012345678901234',
    ];
    await testDecoder(fields, values);
  });

  it('should handle complex struct with mixed types', async () => {
    const fields = [
      { name: 'boolValue', type: 'bool', size: 8 },
      { name: 'uint24Value', type: 'uint24', size: 24 },
      { name: 'int48Value', type: 'int48', size: 48 },
      { name: 'bytes8Value', type: 'bytes8', size: 64 },
      { name: 'addressValue', type: 'address', size: 160 },
    ];
    const values = [
      true,
      16777215,
      BigInt('140737488355327'),
      '0x1234567890123456',
      '0xdEADBEeF00000000000000000000000000000000',
    ];
    await testDecoder(fields, values);
  });

  it('should handle mixed types including negative integers', async () => {
    const fields = [
      { name: 'int16Value', type: 'int16', size: 16 },
      { name: 'uint32Value', type: 'uint32', size: 32 },
      { name: 'boolValue', type: 'bool', size: 8 },
      { name: 'bytes4Value', type: 'bytes4', size: 32 },
      { name: 'addressValue', type: 'address', size: 160 },
    ];
    const values = [
      -1234,
      4294967295,
      false,
      '0xdeadbeef',
      '0x1234567890123456789012345678901234567890',
    ];
    await testDecoder(fields, values);
  });

  it('should handle large unsigned integers and small bytes', async () => {
    const fields = [
      { name: 'uint128Value', type: 'uint128', size: 128 },
      { name: 'bytes2Value', type: 'bytes2', size: 16 },
      { name: 'uint8Value', type: 'uint8', size: 8 },
      { name: 'boolValue', type: 'bool', size: 8 },
    ];
    const values = [
      BigInt('340282366920938463463374607431768211455'),
      '0xabcd',
      255,
      true,
    ];
    await testDecoder(fields, values);
  });

  it('should handle multiple addresses and mixed integer sizes', async () => {
    const fields = [
      { name: 'address1', type: 'address', size: 160 },
      { name: 'uint40Value', type: 'uint40', size: 40 },
      { name: 'address2', type: 'address', size: 160 },
      { name: 'int24Value', type: 'int24', size: 24 },
      { name: 'bytes3Value', type: 'bytes3', size: 24 },
    ];
    const values = [
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      BigInt('1099511627775'),
      '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      -8388608,
      '0xffffff',
    ];
    await testDecoder(fields, values);
  });

  it('should handle uint32, bytes4, bytes16, int128, bytes32, and address', async () => {
    const fields = [
      { name: 'uint32Value', type: 'uint32', size: 32 },
      { name: 'bytes4Value', type: 'bytes4', size: 32 },
      { name: 'bytes16Value', type: 'bytes16', size: 128 },
      { name: 'int128Value', type: 'int128', size: 128 },
      { name: 'bytes32Value', type: 'bytes32', size: 256 },
      { name: 'addressValue', type: 'address', size: 160 },
    ];
    const values = [
      4294967295,
      '0x12345678',
      '0x0123456789abcdef0123456789abcdef',
      BigInt('-170141183460469231731687303715884105728'),
      '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      '0xcccccccccccccccccccccccccccccccccccccccc',
    ];
    await testDecoder(fields, values);
  });
});
