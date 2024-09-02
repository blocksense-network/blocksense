import { expect } from 'chai';
import { ethers } from 'hardhat';
import fs from 'fs';
import path from 'path';
import ejs from 'ejs';
import { run } from 'hardhat';

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

  it('should correctly decode packed sports data with boolean fields', async () => {
    const fields = [
      { name: 'isHomeTeam', type: 'bool', size: 8 },
      { name: 'isOvertime', type: 'bool', size: 8 },
      { name: 'score', type: 'uint16', size: 16 },
    ];
    const decoder = await generateAndDeployDecoder(fields);
    const packedData = ethers.solidityPacked(
      ['bool', 'bool', 'uint16'],
      [true, false, 100],
    );
    const result: any = await decoder.decode(packedData);
    expect(result.isHomeTeam).to.equal(true);
    expect(result.isOvertime).to.equal(false);
    expect(result.score).to.equal(100n);
  });

  it('should correctly decode packed sports data with mixed field types and sizes', async () => {
    const fields = [
      { name: 'gameId', type: 'uint32', size: 32 },
      { name: 'teamName', type: 'bytes32', size: 256 },
      { name: 'playerCount', type: 'uint8', size: 8 },
    ];
    const decoder = await generateAndDeployDecoder(fields);
    const packedData = ethers.solidityPacked(
      ['uint32', 'bytes32', 'uint8'],
      [12345, ethers.encodeBytes32String('TeamA'), 11],
    );
    const result: any = await decoder.decode(packedData);
    expect(result.gameId).to.equal(12345n);
    expect(ethers.decodeBytes32String(result.teamName)).to.equal('TeamA');
    expect(result.playerCount).to.equal(11n);
  });

  it('should handle maximum values for each field type', async () => {
    const fields = [
      { name: 'maxUint8', type: 'uint8', size: 8 },
      { name: 'maxUint16', type: 'uint16', size: 16 },
      { name: 'maxUint32', type: 'uint32', size: 32 },
      { name: 'maxUint64', type: 'uint64', size: 64 },
    ];
    const decoder = await generateAndDeployDecoder(fields);
    const packedData = ethers.solidityPacked(
      ['uint8', 'uint16', 'uint32', 'uint64'],
      [255, 65535, 4294967295, BigInt('18446744073709551615')],
    );
    const result: any = await decoder.decode(packedData);
    expect(result.maxUint8).to.equal(255n);
    expect(result.maxUint16).to.equal(65535n);
    expect(result.maxUint32).to.equal(4294967295n);
    expect(result.maxUint64).to.equal(BigInt('18446744073709551615'));
  });

  it('should handle mixed field types and sizes', async () => {
    const fields = [
      { name: 'isOvertime', type: 'bool', size: 8 },
      { name: 'isFinal', type: 'bool', size: 8 },
      { name: 'homeScore', type: 'uint16', size: 16 },
      { name: 'awayScore', type: 'uint16', size: 16 },
    ];
    const decoder = await generateAndDeployDecoder(fields);
    const packedData = ethers.solidityPacked(
      ['bool', 'bool', 'uint16', 'uint16'],
      [true, false, 110, 108],
    );
    const result: any = await decoder.decode(packedData);
    expect(result.isOvertime).to.equal(true);
    expect(result.isFinal).to.equal(false);
    expect(result.homeScore).to.equal(110n);
    expect(result.awayScore).to.equal(108n);
  });

  it('should correctly decode packed sports data with maximum values', async () => {
    const fields = [
      { name: 'maxUint8', type: 'uint8', size: 8 },
      { name: 'maxUint16', type: 'uint16', size: 16 },
      { name: 'maxUint32', type: 'uint32', size: 32 },
    ];
    const decoder = await generateAndDeployDecoder(fields);
    const packedData = ethers.solidityPacked(
      ['uint8', 'uint16', 'uint32'],
      [255, 65535, 4294967295],
    );
    const result: any = await decoder.decode(packedData);
    expect(result.maxUint8).to.equal(255n);
    expect(result.maxUint16).to.equal(65535n);
    expect(result.maxUint32).to.equal(4294967295n);
  });

  it('should handle different int sizes and address', async () => {
    const fields = [
      { name: 'int8Value', type: 'int8', size: 8 },
      { name: 'int16Value', type: 'int16', size: 16 },
      { name: 'int32Value', type: 'int32', size: 32 },
      { name: 'int64Value', type: 'int64', size: 64 },
      { name: 'addressValue', type: 'address', size: 160 },
    ];
    const decoder = await generateAndDeployDecoder(fields);
    const packedData = ethers.solidityPacked(
      ['int8', 'int16', 'int32', 'int64', 'address'],
      [
        -128,
        -32768,
        -2147483648,
        BigInt('-9223372036854775808'),
        '0x1234567890123456789012345678901234567890',
      ],
    );
    const result: any = await decoder.decode(packedData);
    expect(result.int8Value).to.equal(-128n);
    expect(result.int16Value).to.equal(-32768n);
    expect(result.int32Value).to.equal(-2147483648n);
    expect(result.int64Value).to.equal(BigInt('-9223372036854775808'));
    expect(result.addressValue).to.equal(
      ethers.getAddress('0x1234567890123456789012345678901234567890'),
    );
  });

  it('should handle different bytes sizes', async () => {
    const fields = [
      { name: 'bytes1Value', type: 'bytes1', size: 8 },
      { name: 'bytes16Value', type: 'bytes16', size: 128 },
      { name: 'bytes32Value', type: 'bytes32', size: 256 },
    ];
    const decoder = await generateAndDeployDecoder(fields);
    const packedData = ethers.solidityPacked(
      ['bytes1', 'bytes16', 'bytes32'],
      [
        '0xff',
        '0x1234567890abcdef1234567890abcdef',
        '0x1234567890123456789012345678901234567890123456789012345678901234',
      ],
    );
    const result: any = await decoder.decode(packedData);
    expect(result.bytes1Value).to.equal('0xff');
    expect(result.bytes16Value).to.equal('0x1234567890abcdef1234567890abcdef');
    expect(result.bytes32Value).to.equal(
      '0x1234567890123456789012345678901234567890123456789012345678901234',
    );
  });

  it('should handle complex struct with mixed types', async () => {
    const fields = [
      { name: 'boolValue', type: 'bool', size: 8 },
      { name: 'uint24Value', type: 'uint24', size: 24 },
      { name: 'int48Value', type: 'int48', size: 48 },
      { name: 'bytes8Value', type: 'bytes8', size: 64 },
      { name: 'addressValue', type: 'address', size: 160 },
    ];
    const decoder = await generateAndDeployDecoder(fields);
    const packedData = ethers.solidityPacked(
      ['bool', 'uint24', 'int48', 'bytes8', 'address'],
      [
        true,
        16777215,
        BigInt('140737488355327'),
        '0x1234567890123456',
        '0xdEADBEeF00000000000000000000000000000000',
      ],
    );
    const result: any = await decoder.decode(packedData);
    expect(result.boolValue).to.equal(true);
    expect(result.uint24Value).to.equal(16777215n);
    expect(result.int48Value).to.equal(BigInt('140737488355327'));
    expect(result.bytes8Value).to.equal('0x1234567890123456');
    expect(result.addressValue).to.equal(
      ethers.getAddress('0xdEADBEeF00000000000000000000000000000000'),
    );
  });

  it('should handle mixed types including negative integers', async () => {
    const fields = [
      { name: 'int16Value', type: 'int16', size: 16 },
      { name: 'uint32Value', type: 'uint32', size: 32 },
      { name: 'boolValue', type: 'bool', size: 8 },
      { name: 'bytes4Value', type: 'bytes4', size: 32 },
      { name: 'addressValue', type: 'address', size: 160 },
    ];
    const decoder = await generateAndDeployDecoder(fields);
    const packedData = ethers.solidityPacked(
      ['int16', 'uint32', 'bool', 'bytes4', 'address'],
      [
        -1234,
        4294967295,
        false,
        '0xdeadbeef',
        '0x1234567890123456789012345678901234567890',
      ],
    );
    const result: any = await decoder.decode(packedData);
    expect(result.int16Value).to.equal(-1234);
    expect(result.uint32Value).to.equal(4294967295n);
    expect(result.boolValue).to.equal(false);
    expect(result.bytes4Value).to.equal('0xdeadbeef');
    expect(result.addressValue).to.equal(
      ethers.getAddress('0x1234567890123456789012345678901234567890'),
    );
  });

  it('should handle large unsigned integers and small bytes', async () => {
    const fields = [
      { name: 'uint128Value', type: 'uint128', size: 128 },
      { name: 'bytes2Value', type: 'bytes2', size: 16 },
      { name: 'uint8Value', type: 'uint8', size: 8 },
      { name: 'boolValue', type: 'bool', size: 8 },
    ];
    const decoder = await generateAndDeployDecoder(fields);
    const packedData = ethers.solidityPacked(
      ['uint128', 'bytes2', 'uint8', 'bool'],
      [BigInt('340282366920938463463374607431768211455'), '0xabcd', 255, true],
    );
    const result: any = await decoder.decode(packedData);
    expect(result.uint128Value).to.equal(
      BigInt('340282366920938463463374607431768211455'),
    );
    expect(result.bytes2Value).to.equal('0xabcd');
    expect(result.uint8Value).to.equal(255n);
    expect(result.boolValue).to.equal(true);
  });

  it('should handle multiple addresses and mixed integer sizes', async () => {
    const fields = [
      { name: 'address1', type: 'address', size: 160 },
      { name: 'uint40Value', type: 'uint40', size: 40 },
      { name: 'address2', type: 'address', size: 160 },
      { name: 'int24Value', type: 'int24', size: 24 },
      { name: 'bytes3Value', type: 'bytes3', size: 24 },
    ];
    const decoder = await generateAndDeployDecoder(fields);
    const packedData = ethers.solidityPacked(
      ['address', 'uint40', 'address', 'int24', 'bytes3'],
      [
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        BigInt('1099511627775'),
        '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        -8388608,
        '0xffffff',
      ],
    );
    const result: any = await decoder.decode(packedData);
    expect(result.address1).to.equal(
      ethers.getAddress('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
    );
    expect(result.uint40Value).to.equal(BigInt('1099511627775'));
    expect(result.address2).to.equal(
      ethers.getAddress('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'),
    );
    expect(result.int24Value).to.equal(-8388608);
    expect(result.bytes3Value).to.equal('0xffffff');
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
    const decoder = await generateAndDeployDecoder(fields);
    const packedData = ethers.solidityPacked(
      ['uint32', 'bytes4', 'bytes16', 'int128', 'bytes32', 'address'],
      [
        4294967295,
        '0x12345678',
        '0x0123456789abcdef0123456789abcdef',
        BigInt('-170141183460469231731687303715884105728'),
        '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        '0xcccccccccccccccccccccccccccccccccccccccc',
      ],
    );
    const result: any = await decoder.decode(packedData);
    expect(result.uint32Value).to.equal(4294967295n);
    expect(result.bytes4Value).to.equal('0x12345678');
    expect(result.bytes16Value).to.equal('0x0123456789abcdef0123456789abcdef');
    expect(result.int128Value).to.equal(
      BigInt('-170141183460469231731687303715884105728'),
    );
    expect(result.bytes32Value).to.equal(
      '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    );
    expect(result.addressValue).to.equal(
      ethers.getAddress('0xcccccccccccccccccccccccccccccccccccccccc'),
    );
  });
});
