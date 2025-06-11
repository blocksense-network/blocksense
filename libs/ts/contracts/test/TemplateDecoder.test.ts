import { expect } from 'chai';
import hre, { ethers, run } from 'hardhat';
import path from 'path';
import fs from 'fs';
import { processFieldsAndEncodeData } from '../templates/encode-packed/utils';
import * as sszUtils from '../templates/ssz/utils';
import * as utils from '../templates/utils';
import { generateDecoder as generateDecoderEP } from '../templates/encode-packed';
import { generateDecoder as generateDecoderSSZ } from '../templates/ssz';
import { EncodePackedDecoder, SSZDecoder } from '../typechain';

describe('Template Decoder @skip-coverage', function () {
  this.timeout(1000000);

  const encodePacked = {
    contractName: 'EncodePackedDecoder',
    templatePath: path.join(
      __dirname,
      '../templates/encode-packed/decoder.sol.ejs',
    ),
    tempFilePath: path.join(__dirname, '../contracts/EncodePackedDecoder.sol'),
  };

  const ssz = {
    contractName: 'SSZDecoder',
    templatePath: path.join(__dirname, '../templates/ssz/decoder.sol.ejs'),
    tempFilePath: path.join(__dirname, '../contracts/SSZDecoder.sol'),
  };

  before(() => {
    hre.config.solidity.compilers[0].settings.viaIR = true;
    hre.config.solidity.compilers[0].settings.evmVersion = 'cancun';
  });

  async function generateAndDeployDecoders(fields: utils.TupleField) {
    const templateEP = await fs.promises.readFile(
      encodePacked.templatePath,
      'utf-8',
    );
    const templateSSZ = await fs.promises.readFile(ssz.templatePath, 'utf-8');

    await fs.promises.writeFile(
      encodePacked.tempFilePath,
      await generateDecoderEP(templateEP, fields),
      'utf-8',
    );
    await fs.promises.writeFile(
      ssz.tempFilePath,
      await generateDecoderSSZ(templateSSZ, fields),
      'utf-8',
    );

    await run('compile');

    const DecoderFactoryEP = await ethers.getContractFactory(
      encodePacked.contractName,
    );
    const DecoderFactorySSZ = await ethers.getContractFactory(ssz.contractName);
    return {
      decoderEP: (await DecoderFactoryEP.deploy()) as EncodePackedDecoder,
      decoderSSZ: (await DecoderFactorySSZ.deploy()) as SSZDecoder,
    };
  }

  async function testDecoder(fields: utils.TupleField, values: any[]) {
    const sszData = await sszUtils.sszEncodeData(fields, values);
    const [, packedValues] = processFieldsAndEncodeData(
      [fields],
      [structuredClone(values)],
    );
    const { decoderEP, decoderSSZ } = await generateAndDeployDecoders(fields);

    const result = await decoderEP.decode(packedValues[0]);
    const sszResult = await decoderSSZ.decode(sszData);
    expect(result).to.deep.equal(values);
    expect(sszResult).to.deep.equal(values);
  }

  afterEach(() => {
    fs.rmSync(encodePacked.tempFilePath, { force: true });
    fs.rmSync(ssz.tempFilePath, { force: true });
  });

  after(() => {
    hre.config.solidity.compilers[0].settings.viaIR = false;
    hre.config.solidity.compilers[0].settings.evmVersion = '';
  });

  describe('Primitive', function () {
    it('should correctly decode packed sports data with boolean fields', async () => {
      const fields: utils.TupleField = {
        name: 'GameData',
        type: 'tuple',
        components: [
          { name: 'isHomeTeam', type: 'bool', size: 8 },
          { name: 'isOvertime', type: 'bool', size: 8 },
          { name: 'score', type: 'uint16', size: 16 },
        ],
      };
      const values = [true, false, 100];
      await testDecoder(fields, values);
    });

    it('should correctly decode packed sports data with mixed field types and sizes', async () => {
      const fields: utils.TupleField = {
        name: 'GameData',
        type: 'tuple',
        components: [
          { name: 'gameId', type: 'uint32', size: 32 },
          { name: 'teamName', type: 'bytes32', size: 256 },
          { name: 'playerCount', type: 'uint8', size: 8 },
        ],
      };
      const values = [12345, ethers.encodeBytes32String('TeamA'), 11];
      await testDecoder(fields, values);
    });

    it('should handle maximum values for each field type', async () => {
      const fields: utils.TupleField = {
        name: 'MaxValues',
        type: 'tuple',
        components: [
          { name: 'maxUint8', type: 'uint8', size: 8 },
          { name: 'maxUint16', type: 'uint16', size: 16 },
          { name: 'maxUint32', type: 'uint32', size: 32 },
          { name: 'maxUint64', type: 'uint64', size: 64 },
        ],
      };
      const values = [255, 65535, 4294967295, BigInt('18446744073709551615')];
      await testDecoder(fields, values);
    });

    it('should handle mixed field types and sizes', async () => {
      const fields: utils.TupleField = {
        name: 'MixedFields',
        type: 'tuple',
        components: [
          { name: 'isOvertime', type: 'bool', size: 8 },
          { name: 'isFinal', type: 'bool', size: 8 },
          { name: 'homeScore', type: 'uint16', size: 16 },
          { name: 'awayScore', type: 'uint16', size: 16 },
        ],
      };
      const values = [true, false, 110, 108];
      await testDecoder(fields, values);
    });

    it('should correctly decode packed sports data with maximum values', async () => {
      const fields: utils.TupleField = {
        name: 'MaxSportsData',
        type: 'tuple',
        components: [
          { name: 'maxUint8', type: 'uint8', size: 8 },
          { name: 'maxUint16', type: 'uint16', size: 16 },
          { name: 'maxUint32', type: 'uint32', size: 32 },
        ],
      };
      const values = [255, 65535, 4294967295];
      await testDecoder(fields, values);
    });

    it('should handle different int sizes and address', async () => {
      const fields: utils.TupleField = {
        name: 'IntAndAddress',
        type: 'tuple',
        components: [
          { name: 'int8Value', type: 'int8', size: 8 },
          { name: 'int16Value', type: 'int16', size: 16 },
          { name: 'int32Value', type: 'int32', size: 32 },
          { name: 'int64Value', type: 'int64', size: 64 },
          { name: 'addressValue', type: 'address', size: 160 },
        ],
      };
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
      const fields: utils.TupleField = {
        name: 'BytesSizes',
        type: 'tuple',
        components: [
          { name: 'bytes1Value', type: 'bytes1', size: 8 },
          { name: 'bytes16Value', type: 'bytes16', size: 128 },
          { name: 'bytes32Value', type: 'bytes32', size: 256 },
        ],
      };
      const values = [
        '0xff',
        '0x1234567890abcdef1234567890abcdef',
        '0x1234567890123456789012345678901234567890123456789012345678901234',
      ];
      await testDecoder(fields, values);
    });

    it('should handle complex struct with mixed types', async () => {
      const fields: utils.TupleField = {
        name: 'ComplexStruct',
        type: 'tuple',
        components: [
          { name: 'boolValue', type: 'bool', size: 8 },
          { name: 'uint24Value', type: 'uint24', size: 24 },
          { name: 'int48Value', type: 'int48', size: 48 },
          { name: 'bytes8Value', type: 'bytes8', size: 64 },
          { name: 'addressValue', type: 'address', size: 160 },
        ],
      };
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
      const fields: utils.TupleField = {
        name: 'MixedWithNegatives',
        type: 'tuple',
        components: [
          { name: 'int16Value', type: 'int16', size: 16 },
          { name: 'uint32Value', type: 'uint32', size: 32 },
          { name: 'boolValue', type: 'bool', size: 8 },
          { name: 'bytes4Value', type: 'bytes4', size: 32 },
          { name: 'addressValue', type: 'address', size: 160 },
        ],
      };
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
      const fields: utils.TupleField = {
        name: 'LargeUintSmallBytes',
        type: 'tuple',
        components: [
          { name: 'uint128Value', type: 'uint128', size: 128 },
          { name: 'bytes2Value', type: 'bytes2', size: 16 },
          { name: 'uint8Value', type: 'uint8', size: 8 },
          { name: 'boolValue', type: 'bool', size: 8 },
        ],
      };
      const values = [
        BigInt('340282366920938463463374607431768211455'),
        '0xabcd',
        255,
        true,
      ];
      await testDecoder(fields, values);
    });

    it('should handle multiple addresses and mixed integer sizes', async () => {
      const fields: utils.TupleField = {
        name: 'MultiAddressMixedInts',
        type: 'tuple',
        components: [
          { name: 'address1', type: 'address', size: 160 },
          { name: 'uint40Value', type: 'uint40', size: 40 },
          { name: 'address2', type: 'address', size: 160 },
          { name: 'int24Value', type: 'int24', size: 24 },
          { name: 'bytes3Value', type: 'bytes3', size: 24 },
        ],
      };
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
      const fields: utils.TupleField = {
        name: 'MixedTypes',
        type: 'tuple',
        components: [
          { name: 'uint32Value', type: 'uint32', size: 32 },
          { name: 'bytes4Value', type: 'bytes4', size: 32 },
          { name: 'bytes16Value', type: 'bytes16', size: 128 },
          { name: 'int128Value', type: 'int128', size: 128 },
          { name: 'bytes32Value', type: 'bytes32', size: 256 },
          { name: 'addressValue', type: 'address', size: 160 },
        ],
      };
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

    it('should handle fixed size array, uint256, bytes16, and bool', async () => {
      const fields: utils.TupleField = {
        name: 'FixedArraysAndLargeInts',
        type: 'tuple',
        components: [
          { name: 'uint8Array1', type: 'uint8[4]', size: 8 },
          { name: 'uint256Value1', type: 'uint256', size: 256 },
          { name: 'uint8Array2', type: 'uint8[4]', size: 8 },
          { name: 'uint256Value2', type: 'uint256', size: 256 },
          { name: 'bytes16Value', type: 'bytes16', size: 128 },
          { name: 'boolValue', type: 'bool', size: 8 },
        ],
      };

      const values = [
        [10, 20, 30, 40],
        BigInt(
          '115792089237316195423570985008687907853269984665640564039457584007913129639935',
        ),
        [50, 60, 70, 80],
        BigInt(
          '115792089237316195423570985008687907853269984665640564039457584007913129639935',
        ),
        '0x1234567890abcdef1234567890abcdef',
        true,
      ];
      await testDecoder(fields, values);
    });

    it('should handle fixed size arrays of different types and sizes', async () => {
      const fields: utils.TupleField = {
        name: 'MixedFixedArrays',
        type: 'tuple',
        components: [
          { name: 'uint32Array', type: 'uint32[9]', size: 32 },
          { name: 'bytes4Array', type: 'bytes4[2]', size: 32 },
          { name: 'addressArray', type: 'address[2]', size: 160 },
          { name: 'int128Array', type: 'int128[2]', size: 128 },
          { name: 'boolArray', type: 'bool[4]', size: 8 },
        ],
      };
      const values = [
        [
          1234567890, 2345678901, 3456789012, 456789012, 567890124, 678901345,
          780123456, 890123456, 912345678,
        ],
        ['0x12345678', '0x90abcdef'],
        [
          '0x1111111111111111111111111111111111111111',
          '0x2222222222222222222222222222222222222222',
        ],
        [
          BigInt('-170141183460469231731687303715884105728'),
          BigInt('170141183460469231731687303715884105727'),
        ],
        [true, false, true, false],
      ];
      await testDecoder(fields, values);
    });

    it('should handle mixed types including fixed size arrays and single values', async () => {
      const fields: utils.TupleField = {
        name: 'MixedTypesWithArrays',
        type: 'tuple',
        components: [
          { name: 'uint8Array', type: 'uint8[3]', size: 8 },
          { name: 'bytes32Value', type: 'bytes32', size: 256 },
          { name: 'int256Array', type: 'int256[2]', size: 256 },
          { name: 'addressValue', type: 'address', size: 160 },
          { name: 'boolArray', type: 'bool[3]', size: 8 },
          { name: 'uint256Value', type: 'uint256', size: 256 },
        ],
      };
      const values = [
        [255, 128, 0],
        '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        [
          BigInt(
            '-57896044618658097711785492504343953926634992332820282019728792003956564819968',
          ),
          BigInt(
            '57896044618658097711785492504343953926634992332820282019728792003956564819967',
          ),
        ],
        '0xdddddddddddddddddddddddddddddddddddddddd',
        [true, false, true],
        BigInt(
          '115792089237316195423570985008687907853269984665640564039457584007913129639935',
        ),
      ];
      await testDecoder(fields, values);
    });

    it('should handle uint256 and bytes32 fixed arrays among other values', async () => {
      const fields: utils.TupleField = {
        name: 'LargeArraysWithMixedTypes',
        type: 'tuple',
        components: [
          { name: 'uint256Array', type: 'uint256[3]', size: 256 },
          { name: 'bytes32Array', type: 'bytes32[2]', size: 256 },
          { name: 'addressValue', type: 'address', size: 160 },
          { name: 'boolValue', type: 'bool', size: 8 },
          { name: 'int128Value', type: 'int128', size: 128 },
        ],
      };
      const values = [
        [
          BigInt(
            '115792089237316195423570985008687907853269984665640564039457584007913129639935',
          ),
          BigInt(
            '57896044618658097711785492504343953926634992332820282019728792003956564819967',
          ),
          BigInt('1234567890123456789012345678901234567890'),
        ],
        [
          '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          '0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
        ],
        '0x1234567890123456789012345678901234567890',
        true,
        BigInt('-170141183460469231731687303715884105728'),
      ];
      await testDecoder(fields, values);
    });
  });

  describe('Nested', function () {
    it('should handle nested structs', async () => {
      const fields: utils.TupleField = {
        name: 'NestedStructs',
        type: 'tuple',
        components: [
          { name: 'outerUint', type: 'uint256', size: 256 },
          {
            name: 'innerStruct',
            type: 'tuple',
            components: [
              { name: 'innerBool', type: 'bool', size: 8 },
              {
                name: 'deeperStruct',
                type: 'tuple',
                components: [
                  { name: 'deeperAddress', type: 'address', size: 160 },
                  { name: 'deeperInt', type: 'int64', size: 64 },
                ],
              },
            ],
          },
          { name: 'outerBytes', type: 'bytes32', size: 256 },
        ],
      };
      const values = [
        BigInt('123456789012345678901234567890'),
        [
          true,
          [
            '0x1234567890123456789012345678901234567890',
            BigInt('-9223372036854775808'),
          ],
        ],
        '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      ];
      await testDecoder(fields, values);
    });

    it('should handle nested structs with arrays', async () => {
      const fields: utils.TupleField = {
        name: 'NestedStructsWithArrays',
        type: 'tuple',
        components: [
          { name: 'outerUint', type: 'uint256', size: 256 },
          {
            name: 'innerStructArray',
            type: 'tuple',
            components: [
              { name: 'innerBool', type: 'bool', size: 8 },
              {
                name: 'deeperIntArray',
                type: 'int64[2]',
                size: 64,
              },
              {
                name: 'deeperStruct',
                type: 'tuple',
                components: [
                  { name: 'deeperAddress', type: 'address', size: 160 },
                  {
                    name: 'deeperIntArray',
                    type: 'int64[3]',
                    size: 64,
                  },
                ],
              },
            ],
          },
          { name: 'outerBytes', type: 'bytes32', size: 256 },
        ],
      };
      const values = [
        BigInt('987654321098765432109876543210'),
        [
          false,
          [BigInt('-1234567890'), BigInt('1234567890')],
          [
            '0x1234567890abcdef1234567890abcdef12345678',
            [BigInt('-987654321'), BigInt('123456789'), BigInt('555555555')],
          ],
        ],
        '0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
      ];
      await testDecoder(fields, values);
    });

    it('should handle struct fixed array', async () => {
      const fields: utils.TupleField = {
        name: 'StructFixedArray',
        type: 'tuple',
        components: [
          {
            name: 'structArray',
            type: 'tuple[3]',
            components: [
              { name: 'id', type: 'uint256', size: 256 },
              { name: 'active', type: 'bool', size: 8 },
              { name: 'balance', type: 'int64', size: 64 },
            ],
          },
        ],
      };
      const values = [
        [
          [BigInt('1'), true, BigInt('1000000')],
          [BigInt('2'), false, BigInt('-500000')],
          [BigInt('3'), true, BigInt('750000')],
        ],
      ];
      await testDecoder(fields, values);
    });

    it('should handle structs with arrays of nested structs', async () => {
      const fields: utils.TupleField = {
        name: 'StructWithArraysOfNestedStructs',
        type: 'tuple',
        components: [
          {
            name: 'mainStruct',
            type: 'tuple',
            components: [
              { name: 'id', type: 'uint256', size: 256 },
              {
                name: 'nestedStructs',
                type: 'tuple[3]',
                components: [
                  { name: 'subId', type: 'uint32', size: 32 },
                  { name: 'name', type: 'bytes32', size: 256 },
                  {
                    name: 'details',
                    type: 'tuple[2]',
                    components: [
                      { name: 'value', type: 'int64', size: 64 },
                      { name: 'active', type: 'bool', size: 8 },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };
      const values = [
        [
          BigInt('1000'),
          [
            [
              42,
              ethers.encodeBytes32String('First'),
              [
                [BigInt('1000000'), true],
                [BigInt('-500000'), false],
              ],
            ],
            [
              43,
              ethers.encodeBytes32String('Second'),
              [
                [BigInt('-500000'), true],
                [BigInt('750000'), true],
              ],
            ],
            [
              44,
              ethers.encodeBytes32String('Third'),
              [
                [BigInt('750000'), false],
                [BigInt('142537'), true],
              ],
            ],
          ],
        ],
      ];
      await testDecoder(fields, values);
    });
  });

  describe('Dynamic primitive', function () {
    it('should handle dynamic array with different data types', async () => {
      const fields: utils.TupleField = {
        name: 'DynamicArrayWithUint8Array',
        type: 'tuple',
        components: [
          { name: 'dynamicArray', type: 'bytes16[]', size: 128 },
          { name: 'uint8Array', type: 'uint8[2]', size: 8 },
          { name: 'uint256Value', type: 'uint256', size: 256 },
          { name: 'uint8Array2', type: 'uint8[]', size: 8 },
          { name: 'uint256Array', type: 'uint256[2]', size: 256 },
          { name: 'uint96Array', type: 'uint96[]', size: 96 },
          { name: 'uint256Value2', type: 'uint256', size: 256 },
          { name: 'uint8Array3', type: 'uint8[6]', size: 8 },
        ],
      };
      const values = [
        [
          '0x1234567890abcdef1234567890abcdef',
          '0xabcdef1234567890abcdef1234567812',
          '0x1234567890abcdef1234567890abcdea',
        ],
        [1, 2],
        23456678,
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        [BigInt('123456789012345678901234567890'), BigInt('45678901234567890')],
        [1, 2, 3, 4],
        23456,
        [1, 2, 3, 4, 5, 6],
      ];
      await testDecoder(fields, values);
    });

    it('should handle dynamic array of primitive bytes', async () => {
      const fields: utils.TupleField = {
        name: 'DynamicArrayOfAddresses',
        type: 'tuple',
        components: [
          { name: 'bytes16Array', type: 'bytes16[]', size: 128 },
          { name: 'bytes24Array', type: 'bytes24[]', size: 192 },
          { name: 'uint256Value', type: 'uint256', size: 256 },
        ],
      };
      const values = [
        [
          '0x12345678901234567890123456789012',
          '0xabcdefabcdefabcdefabcdefabcdefab',
        ],
        [
          '0x123456789012345678901234567890123456789012345678',
          '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
          '0xfedcbafedcbafedcbafedcbafedcbafedcbafedcbafedcba',
        ],
        BigInt('123456789012345678901234567890'),
      ];
      await testDecoder(fields, values);
    });

    it('should handle dynamic array of addresses', async () => {
      const fields: utils.TupleField = {
        name: 'DynamicArrayOfAddresses',
        type: 'tuple',
        components: [
          { name: 'addressArray', type: 'address[]', size: 160 },
          { name: 'uint256Value', type: 'uint256', size: 256 },
        ],
      };
      const values = [
        [
          '0x1234567890123456789012345678901234567890',
          '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
          '0xfedcbafedcbafedcbafedcbafedcbafedcbafeda',
        ],
        BigInt('123456789012345678901234567890'),
      ];
      await testDecoder(fields, values);
    });

    it('should handle dynamic array of booleans', async () => {
      const fields: utils.TupleField = {
        name: 'DynamicArrayOfBooleans',
        type: 'tuple',
        components: [
          { name: 'boolArray', type: 'bool[]', size: 8 },
          { name: 'uint64Value', type: 'uint64', size: 64 },
        ],
      };
      const values = [
        [true, false, true, true, false],
        BigInt('12345678901234'),
      ];
      await testDecoder(fields, values);
    });

    it('should handle dynamic array of bytes', async () => {
      const fields: utils.TupleField = {
        name: 'DynamicArrayOfBytes',
        type: 'tuple',
        components: [
          { name: 'bytesArray', type: 'bytes32[]', size: 256 },
          { name: 'int128Value', type: 'int128', size: 128 },
          { name: 'bytesArray2', type: 'bytes32[]', size: 256 },
        ],
      };
      const values = [
        [
          ethers.encodeBytes32String('Hello, World!'),
          ethers.encodeBytes32String('Why so serious'),
          ethers.encodeBytes32String('The weather is good'),
        ],
        BigInt('-170141183460469231731687303715884105728'), // Min value for int128
        [
          ethers.encodeBytes32String('Why so serious'),
          ethers.encodeBytes32String('The weather is good'),
          ethers.encodeBytes32String('Hello, World!'),
        ],
      ];
      await testDecoder(fields, values);
    });

    it('should handle dynamic uint256 array', async () => {
      const fields: utils.TupleField = {
        name: 'DynamicUint256Array',
        type: 'tuple',
        components: [
          { name: 'uint256Array', type: 'uint256[]', size: 256 },
          { name: 'int32Value', type: 'int32', size: 32 },
        ],
      };
      const values = [
        [
          BigInt(
            '115792089237316195423570985008687907853269984665640564039457584007913129639935',
          ), // Max value for uint256
          BigInt('0'),
          BigInt('1234567890123456789012345678901234567890'),
          BigInt('340282366920938463463374607431768211455'), // 2^128 - 1
        ],
        -2147483648, // Min value for int32
      ];
      await testDecoder(fields, values);
    });
  });

  describe('Fixed multidimensional primitive', function () {
    it('should handle nested fixed arrays', async () => {
      const fields: utils.TupleField = {
        name: 'NestedDynamicArrays',
        type: 'tuple',
        components: [
          { name: 'nestedArray', type: 'uint32[3][3]', size: 32 },
          { name: 'bytes32Value', type: 'bytes32', size: 256 },
        ],
      };
      const values = [
        [
          [1, 2, 3],
          [4, 5, 5],
          [6, 7, 8],
        ],
        ethers.encodeBytes32String('NestedArrayTest'),
      ];
      await testDecoder(fields, values);
    });

    it('should handle 2D fixed array', async () => {
      const fields: utils.TupleField = {
        name: 'TwoDimensionalFixedArray',
        type: 'tuple',
        components: [
          { name: 'array2D', type: 'uint16[2][3]', size: 16 },
          { name: 'int64Value', type: 'int64', size: 64 },
        ],
      };
      const values = [
        [
          [1, 2],
          [3, 4],
          [5, 6],
        ],
        BigInt('-9223372036854775808'), // Min value for int64
      ];
      await testDecoder(fields, values);
    });

    it('should handle 3D fixed array', async () => {
      const fields: utils.TupleField = {
        name: 'ThreeDimensionalFixedArray',
        type: 'tuple',
        components: [
          { name: 'array3D', type: 'int8[4][3][2]', size: 8 },
          { name: 'uint128Value', type: 'uint128', size: 128 },
        ],
      };
      const values = [
        [
          [
            [-128, 127, 2, -1],
            [0, 1, 2, 3],
            [4, 5, 6, 7],
          ],
          [
            [10, -10, 0, -12],
            [-50, 50, 0, 12],
            [-25, 25, 0, -32],
          ],
        ],
        BigInt('340282366920938463463374607431768211455'), // Max value for uint128
      ];
      await testDecoder(fields, values);
    });

    it('should handle 4D fixed array', async () => {
      const fields: utils.TupleField = {
        name: 'FourDimensionalFixedArray',
        type: 'tuple',
        components: [
          { name: 'array4D', type: 'bool[3][2][3][2]', size: 8 },
          { name: 'bytes16Value', type: 'bytes16', size: 128 },
        ],
      };
      const values = [
        [
          [
            [
              [true, false, true],
              [false, true, true],
            ],
            [
              [true, true, false],
              [false, false, true],
            ],
            [
              [false, true, true],
              [true, false, false],
            ],
          ],
          [
            [
              [false, true, false],
              [true, false, true],
            ],
            [
              [false, false, true],
              [true, true, false],
            ],
            [
              [true, false, true],
              [false, true, false],
            ],
          ],
        ],
        ethers.hexlify(ethers.randomBytes(16)), // Random 16 bytes
      ];
      await testDecoder(fields, values);
    });

    it('should handle 2x3 array of struct type', async () => {
      const fields: utils.TupleField = {
        name: 'TwoDimensionalStructArray',
        type: 'tuple',
        components: [
          {
            name: 'structArray',
            type: 'tuple[3][2]',
            components: [
              { name: 'intValue', type: 'int32', size: 32 },
              { name: 'boolValue', type: 'bool', size: 8 },
              { name: 'addressValue', type: 'address', size: 160 },
            ],
          },
        ],
      };
      const values = [
        [
          [
            [123, true, '0x1234567890123456789012345678901234567890'],
            [-456, false, '0x2345678901234567890123456789012345678901'],
            [789, true, '0x3456789012345678901234567890123456789012'],
          ],
          [
            [-987, false, '0x4567890123456789012345678901234567890123'],
            [654, true, '0x5678901234567890123456789012345678901234'],
            [-321, false, '0x6789012345678901234567890123456789012345'],
          ],
        ],
      ];
      await testDecoder(fields, values);
    });
  });

  describe('String and bytes', function () {
    it('should handle string and bytes', async () => {
      const fields: utils.TupleField = {
        name: 'StringField',
        type: 'tuple',
        components: [
          { name: 'stringValue', type: 'string' },
          {
            name: 'stringValue2',
            type: 'string',
          },
          {
            name: 'uint32Value',
            type: 'uint32',
            size: 32,
          },
          {
            name: 'bytesValue',
            type: 'bytes',
          },
          {
            name: 'uint256Value',
            type: 'uint256',
            size: 256,
          },
        ],
      };
      const values = [
        'Hello, World! And hello my fellow sunshine and rain!',
        'Hello, World!',
        42,
        ethers.hexlify(ethers.randomBytes(106)),
        BigInt(
          '115792089237316195423570985008687907853269984665640564039457584007913129639935',
        ),
      ];
      await testDecoder(fields, values);
    });

    it('should handle fixed array of bytes and string', async () => {
      const fields: utils.TupleField = {
        name: 'FixedArrayField',
        type: 'tuple',
        components: [
          {
            name: 'fixedStringArray',
            type: 'string[2]',
          },
          {
            name: 'uint16Value',
            type: 'uint16',
            size: 16,
          },
          {
            name: 'fixedBytesArray',
            type: 'bytes[3]',
          },
          {
            name: 'stringValue',
            type: 'string',
          },
        ],
      };
      const values = [
        ['String 1 with some data', 'String 2 with even more data'],
        42,
        [
          ethers.hexlify(ethers.randomBytes(104)),
          ethers.hexlify(ethers.randomBytes(15)),
          ethers.hexlify(ethers.randomBytes(73)),
        ],
        'Hello, World!',
      ];
      await testDecoder(fields, values);
    });

    it('should handle struct with bytes and string fields', async () => {
      const fields: utils.TupleField = {
        name: 'StructField',
        type: 'tuple',
        components: [
          {
            name: 'uint8Field',
            type: 'uint8',
            size: 8,
          },
          {
            name: 'stringData',
            type: 'string',
          },
          {
            name: 'structValue',
            type: 'tuple',
            components: [
              {
                name: 'uint16Field',
                type: 'uint16',
                size: 16,
              },
              {
                name: 'bytesField',
                type: 'bytes',
              },
              {
                name: 'stringField',
                type: 'string',
              },
            ],
          },
          {
            name: 'uint32Field',
            type: 'uint32',
            size: 32,
          },
          {
            name: 'uint32Field2',
            type: 'uint32',
            size: 32,
          },
        ],
      };
      const values = [
        3,
        'abc',
        [
          42,
          ethers.hexlify(ethers.randomBytes(50)),
          'This is a string inside a struct',
        ],
        5,
        6,
      ];
      await testDecoder(fields, values);
    });

    it('should handle dynamic array of string and bytes', async () => {
      const fields: utils.TupleField = {
        name: 'DynamicArrayField',
        type: 'tuple',
        components: [
          {
            name: 'dynamicStringArray',
            type: 'string[]',
          },
          {
            name: 'fixedDynamicStringArray',
            type: 'string[][2]',
          },
          {
            name: 'fixedStringArray',
            type: 'string[2]',
          },
          {
            name: 'dynamicUint32',
            type: 'uint32[]',
            size: 32,
          },
          {
            name: 'dynamicBytesArray',
            type: 'bytes[]',
          },
        ],
      };
      const values = [
        ['String 1', 'String 2', 'String 3 with more data'],
        [['String 4', 'String 5'], ['abc']],
        ['String 6', 'String 7'],
        [1, 2, 3, 4],
        [
          ethers.hexlify(ethers.randomBytes(10)),
          ethers.hexlify(ethers.randomBytes(20)),
          ethers.hexlify(ethers.randomBytes(30)),
          ethers.hexlify(ethers.randomBytes(40)),
        ],
      ];
      await testDecoder(fields, values);
    });

    it('should handle struct with dynamic arrays of bytes and string', async () => {
      const fields: utils.TupleField = {
        name: 'StructWithArrays',
        type: 'tuple',
        components: [
          {
            name: 'structField',
            type: 'tuple',
            components: [
              {
                name: 'addressField',
                type: 'address',
                size: 160,
              },
              {
                name: 'bytesArray',
                type: 'bytes[]',
              },
              {
                name: 'uintFixedArray',
                type: 'uint256[5]',
                size: 256,
              },
              {
                name: 'stringArray',
                type: 'string[3]',
              },
              {
                name: 'uintDynamicArray',
                type: 'uint128[]',
                size: 128,
              },
              {
                name: 'boolField',
                type: 'bool',
                size: 8,
              },
              {
                name: 'bytes16Field',
                type: 'bytes16[]',
                size: 128,
              },
            ],
          },
        ],
      };
      const values = [
        [
          ethers.Wallet.createRandom().address,
          [
            ethers.hexlify(ethers.randomBytes(5)),
            ethers.hexlify(ethers.randomBytes(10)),
            ethers.hexlify(ethers.randomBytes(15)),
          ],
          [1, 2, 3, 4, 5],
          ['First string', 'Second string', 'Third string with more data'],
          [100, 200, 300],
          true,
          [ethers.hexlify(ethers.randomBytes(16))],
        ],
      ];
      await testDecoder(fields, values);
    });
  });

  describe('Dynamic multidimensional', function () {
    it('should decode n-dimensional dynamic arrays', async () => {
      const fields: utils.TupleField = {
        name: 'NDimensionalArrays',
        type: 'tuple',
        components: [
          {
            name: 'oneDimensional',
            type: 'uint256[]',
            size: 256,
          },
          {
            name: 'twoDimensional',
            type: 'uint256[][]',
            size: 256,
          },
          {
            name: 'uint256Value',
            type: 'uint256',
            size: 256,
          },
          {
            name: 'threeDimensional',
            type: 'uint256[][][]',
            size: 256,
          },
        ],
      };
      const values = [
        [1, 2, 3],
        [
          [10, 20],
          [30, 40, 50],
          [1, 2],
          [1, 2, 3, 4, 5, 6, 6],
        ],
        1,
        [
          [[100, 200], [300], [1, 2, 3]],
          [
            [400, 500, 600],
            [600, 700],
          ],
        ],
      ];
      await testDecoder(fields, values);
    });

    it('should decode multidimensional dynamic and fixed arrays of bytes, string, and uint', async () => {
      const fields: utils.TupleField = {
        name: 'MultidimensionalMixedArrays',
        type: 'tuple',
        components: [
          {
            name: 'bytesArray',
            type: 'bytes[]',
          },
          {
            name: 'stringArray',
            type: 'string[][3]',
          },
          {
            name: 'uintArray',
            type: 'uint256[3][][2]',
            size: 256,
          },
        ],
      };
      const values = [
        ['0x1234', '0x5678', '0x9abc'],
        [
          ['Hello', 'World', 's'],
          ['OpenAI', 'GPT', 'd', 'd'],
          ['Ethereum', 'Blockchain'],
        ],
        [
          [
            [1, 2, 3],
            [4, 5, 6],
          ],
          [
            [7, 8, 9],
            [10, 11, 12],
            [13, 14, 15],
          ],
        ],
      ];
      await testDecoder(fields, values);
    });

    it('should decode fixed+dynamic+fixed arrays with different types of data', async () => {
      const fields: utils.TupleField = {
        name: 'MixedArrayTypes',
        type: 'tuple',
        components: [
          {
            name: 'fixedDynamicFixedArray',
            type: 'uint32[2][]',
            size: 32,
          },
          {
            name: 'stringBytesArray',
            type: 'string[2][]',
          },
        ],
      };
      const values = [
        [
          [1, 2],
          [3, 4],
          [5, 6],
        ],
        [
          ['Hello', 'World'],
          ['OpenAI', 'GPT'],
          ['Ethereum', 'Blockchain'],
        ],
      ];
      await testDecoder(fields, values);
    });

    it('should decode complex nested arrays with mixed types', async () => {
      const fields: utils.TupleField = {
        name: 'ComplexNestedArrays',
        type: 'tuple',
        components: [
          {
            name: 'uint256Value1',
            type: 'uint256',
            size: 256,
          },
          {
            name: 'nestedArray',
            type: 'uint256[2][][3][]',
            size: 256,
          },
          {
            name: 'uint256Value2',
            type: 'uint256',
            size: 256,
          },
          {
            name: 'mixedTypeArray',
            type: 'string[2][][3]',
          },
          {
            name: 'uint256Value3',
            type: 'uint256',
            size: 256,
          },
        ],
      };
      const values = [
        13,
        [
          [
            [
              [1, 2],
              [3, 4],
            ],
            [[5, 6]],
            [
              [7, 8],
              [9, 10],
              [11, 12],
            ],
          ],
          [
            [[13, 14]],
            [
              [15, 16],
              [17, 18],
            ],
            [[19, 20]],
          ],
        ],
        10,
        [
          [
            ['Hello', 'World'],
            ['OpenAI', 'GPT'],
          ],
          [['Ethereum', 'Blockchain']],
          [
            ['Solidity', 'language'],
            ['Ethereum', 'Blockchain'],
            ['Solidity', 'assembly'],
          ],
        ],
        3,
      ];
      await testDecoder(fields, values);
    });

    it('should decode dynamic array of tuple', async () => {
      const fields: utils.TupleField = {
        name: 'DynamicArrayOfTuple',
        type: 'tuple',
        components: [
          { name: 'stringValue', type: 'string' },
          { name: 'uint8Value', type: 'uint8', size: 8 },
          {
            name: 'tupleArray',
            type: 'tuple[]',
            components: [
              {
                name: 'uintField',
                type: 'uint256',
                size: 256,
              },
              {
                name: 'stringField',
                type: 'string',
              },
              {
                name: 'boolField',
                type: 'bool',
                size: 8,
              },
            ],
          },
          {
            name: 'boolValue',
            type: 'bool',
            size: 8,
          },
        ],
      };
      const values = [
        'Dynamic array of tuple',
        5,
        [
          [100, 'First', true],
          [200, 'Second', false],
          [300, 'Third', true],
        ],
        true,
      ];
      await testDecoder(fields, values);
    });

    it('should decode multidimensional dynamic in-between fixed arrays of tuple', async () => {
      const fields: utils.TupleField = {
        name: 'DynamicArrayOfTuple',
        type: 'tuple',
        components: [
          { name: 'stringValue', type: 'string' },
          {
            name: 'tupleArray',
            type: 'tuple[3][][1]',
            components: [
              {
                name: 'uintField',
                type: 'uint256',
                size: 256,
              },
              {
                name: 'stringField',
                type: 'string',
              },
              {
                name: 'boolField',
                type: 'bool',
                size: 8,
              },
            ],
          },
          {
            name: 'boolValue',
            type: 'bool',
            size: 8,
          },
        ],
      };
      const values = [
        'Dynamic array of tuple',
        [
          [
            [
              [100, 'First', true],
              [200, 'Second', false],
              [300, 'Third', true],
            ],
            [
              [400, 'Fourth', true],
              [500, 'Fifth', false],
              [600, 'Sixth', true],
            ],
          ],
        ],
        true,
      ];
      await testDecoder(fields, values);
    });

    it('should decode multidimensional dynamic and fixed arrays of tuple', async () => {
      const fields: utils.TupleField = {
        name: 'DynamicArrayOfTuple',
        type: 'tuple',
        components: [
          { name: 'stringValue', type: 'string' },
          {
            name: 'tupleArray',
            type: 'tuple[3][][]',
            components: [
              {
                name: 'uintField',
                type: 'uint256',
                size: 256,
              },
              {
                name: 'stringField',
                type: 'string',
              },
              {
                name: 'boolField',
                type: 'bool',
                size: 8,
              },
            ],
          },
          {
            name: 'boolValue',
            type: 'bool',
            size: 8,
          },
        ],
      };
      const values = [
        'Dynamic array of tuple',
        [
          [
            [
              [100, 'First', true],
              [200, 'Second', false],
              [300, 'Third', true],
            ],
            [
              [400, 'Fourth', true],
              [500, 'Fifth', false],
              [600, 'Sixth', true],
            ],
          ],
        ],
        true,
      ];
      await testDecoder(fields, values);
    });

    it('should decode nested dynamic tuples', async () => {
      const fields: utils.TupleField = {
        name: 'NestedStructs',
        type: 'tuple',
        components: [
          { name: 'outerUint', type: 'uint256', size: 256 },
          {
            name: 'stringValue',
            type: 'string',
          },
          {
            name: 'innerStruct',
            type: 'tuple[]',
            components: [
              { name: 'innerBool', type: 'bool', size: 8 },
              {
                name: 'deeperStruct',
                type: 'tuple[]',
                components: [
                  { name: 'deeperAddress', type: 'address', size: 160 },
                  {
                    name: 'deeperString',
                    type: 'string',
                  },
                  { name: 'deeperInt', type: 'int64', size: 64 },
                ],
              },
              {
                name: 'innerString',
                type: 'string',
              },
            ],
          },
          {
            name: 'innerStruct2',
            type: 'tuple[]',
            components: [
              { name: 'innerBool', type: 'bool', size: 8 },
              {
                name: 'bytesValue',
                type: 'bytes',
              },
            ],
          },
          { name: 'outerBytes', type: 'bytes32', size: 256 },
        ],
      };
      const values = [
        BigInt('123456789012345678901234567890'),
        'Dynamic array of tuple',
        [
          [
            true,
            [
              [
                '0x1234567890123456789012345678901234567890',
                'Dynamic array of deeper tuple',
                BigInt('-9223372036854775808'),
              ],
              [
                '0xabc4567890123456789012345678901234567890',
                'Dynamic array of deeper tuple once again',
                BigInt('12345'),
              ],
            ],
            'Dynamic array of inner tuple',
          ],
          [
            false,
            [
              [
                '0x1234567890123456789012345678901234567abc',
                'Deeper tuple once more',
                BigInt('-456789'),
              ],
              [
                '0x1111567890123456789012345678901234567890',
                'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
                BigInt('1'),
              ],
              [
                '0xa234567890123456789012345678901234567890',
                'Some long string that is not going to fit in a single slot',
                BigInt('-372036854775808'),
              ],
            ],
            'Dynamic array of inner tuple once again',
          ],
        ],
        [
          [true, ethers.hexlify(ethers.randomBytes(32))],
          [false, ethers.hexlify(ethers.randomBytes(68))],
          [true, ethers.hexlify(ethers.randomBytes(99))],
        ],
        '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      ];
      await testDecoder(fields, values);
    });

    it('should handle fixed size arrays of different types and sizes', async () => {
      const fields: utils.TupleField = {
        name: 'MixedFixedArrays',
        type: 'tuple',
        components: [
          { name: 'uint32Array', type: 'uint32[19]', size: 32 },
          { name: 'bytes4Array', type: 'bytes4[21]', size: 32 },
          { name: 'addressArray', type: 'address[2]', size: 160 },
          { name: 'int128Array', type: 'int128[2]', size: 128 },
          { name: 'boolArray', type: 'bool[4]', size: 8 },
        ],
      };
      const values = [
        [
          1234567890, 2345678901, 3456789012, 456789012, 567890124, 678901345,
          780123456, 890123456, 912345678, 1234567890, 2345678901, 3456789012,
          456789012, 567890124, 678901345, 780123456, 890123456, 912345678,
          912345678,
        ],
        [
          '0x1a2b3c4d',
          '0x5e6f7a8b',
          '0x9c0d1e2f',
          '0x3a4b5c6d',
          '0x7e8f9a0b',
          '0x2c3d4e5f',
          '0x6a7b8c9d',
          '0x0e1f2a3b',
          '0x4c5d6e7f',
          '0x8a9b0c1d',
          '0x2e3f4a5b',
          '0x6c7d8e9f',
          '0x1e2f3a4b',
          '0x5c6d7e8f',
          '0x9a0b1c2d',
          '0x3e4f5a6b',
          '0x7c8d9e0f',
          '0x0a1b2c3d',
          '0x4e5f6a7b',
          '0x8c9d0e1f',
          '0x2a3b4c5d',
        ],
        [
          '0x1111111111111111111111111111111111111111',
          '0x2222222222222222222222222222222222222222',
        ],
        [
          BigInt('-170141183460469231731687303715884105728'),
          BigInt('170141183460469231731687303715884105727'),
        ],
        [true, false, true, false],
      ];
      await testDecoder(fields, values);
    });

    it('should handle mixed fixed and dynamic arrays', async () => {
      const fields: utils.TupleField = {
        name: 'MixedArrayTypes',
        type: 'tuple',
        components: [
          { name: 'fixedArray', type: 'uint32[3]', size: 32 },
          { name: 'dynamicArray', type: 'uint32[]', size: 32 },
          { name: 'fixedArray2', type: 'uint32[2]', size: 32 },
        ],
      };
      const values = [
        [11, 12, 13],
        [14, 15, 16, 17],
        [18, 19],
      ];
      await testDecoder(fields, values);
    });
  });

  describe('Extra cases', function () {
    it('should handle when same tuple exists multiple times', async () => {
      const fields: utils.TupleField = {
        name: 'TupleWithMultiple',
        type: 'tuple',
        components: [
          {
            name: 'tuple1',
            type: 'tuple',
            components: [{ name: 'uint32Field', type: 'uint32', size: 32 }],
          },
          {
            name: 'tuple2',
            type: 'tuple',
            components: [
              {
                name: 'tuple1',
                type: 'tuple',
                components: [{ name: 'uint32Field', type: 'uint32', size: 32 }],
              },
            ],
          },
        ],
      };
      const values = [[1], [[5]]];
      await testDecoder(fields, values);
    });

    it('should return fixed+dynamic+fixed array of main tuple', async () => {
      const fields: utils.TupleField = {
        name: 'Values',
        type: 'tuple[2][][1]',
        components: [
          { name: 'Uint8', type: 'uint8', size: 8 },
          { name: 'Uint16', type: 'uint16', size: 16 },
          { name: 'Uint32', type: 'uint32', size: 32 },
          { name: 'Uint64', type: 'uint64', size: 64 },
          { name: 'Uint128', type: 'uint128', size: 128 },
          { name: 'Uint256', type: 'uint256', size: 256 },
        ],
      };
      const values = [
        [
          [
            [
              1,
              1234,
              48743,
              BigInt('18446744073709551615'),
              BigInt('184467440737095515'),
              6,
            ],
            [
              2,
              3455,
              4376836,
              BigInt('18446743709551615'),
              BigInt('184467440739551615'),
              5,
            ],
          ],
          [
            [
              3,
              44656,
              32681,
              BigInt('184444073709551615'),
              BigInt('184467440737095515'),
              4,
            ],
            [
              4,
              65535,
              1,
              BigInt('184467443709551615'),
              BigInt('184467440737095515'),
              3,
            ],
          ],
          [
            [
              5,
              34344,
              323232,
              BigInt('146744073709551615'),
              BigInt('1467440737095515'),
              2,
            ],
            [
              6,
              23356,
              324687143,
              BigInt('184467440737095516'),
              BigInt('184467447095515'),
              1,
            ],
          ],
        ],
      ];
      await testDecoder(fields, values);
    });

    it('should decode main dynamic tuple array with nested dynamic tuple array', async () => {
      const fields = {
        name: 'MainDynamicTupleArrayWithNested',
        type: 'tuple[]',
        components: [
          {
            name: 'uint32Array',
            type: 'uint32[]',
            size: 32,
          },
          {
            name: 'mainArray',
            type: 'tuple[]',
            components: [
              { name: 'id', type: 'uint256', size: 256 },
              { name: 'name', type: 'string' },
              {
                name: 'nestedArray',
                type: 'tuple[]',
                components: [{ name: 'nestedId', type: 'uint256', size: 256 }],
              },
              {
                name: 'uint32Array',
                type: 'uint16[]',
                size: 16,
              },
            ],
          },
          {
            name: 'stringValue',
            type: 'string',
          },
          {
            name: 'uintValue',
            type: 'uint256',
            size: 256,
          },
        ],
      };
      const values = [
        [
          [1, 2, 3, 4],
          [
            [1, 'Main Item 1', [[11], [12]], [1, 2]],
            [2, 'Main Item 2', [[21], [22], [23]], [3, 4]],
          ],
          'Dynamic array of tuple',
          3,
        ],
        [
          [5, 6, 7, 8],
          [
            [3, 'Main Item 3', [[31], [32], [33]], [5, 6]],
            [4, 'Main Item 4', [[41], [42], [43]], [7, 8]],
          ],
          'Dynamic array of tuple once again',
          5,
        ],
      ];
      await testDecoder(fields, values);
    });

    it('should decode main fixed tuple with dynamic values', async () => {
      const fields: utils.TupleField = {
        name: 'MainFixedTuple',
        type: 'tuple[2]',
        components: [
          { name: 'id', type: 'uint256', size: 256 },
          { name: 'name', type: 'string' },
          {
            name: 'uint32Array',
            type: 'uint16[]',
            size: 16,
          },
        ],
      };
      const values = [
        [1, 'Main Item 1', [1, 2]],
        [2, 'Main Item 2', [3, 4, 5]],
      ];

      await testDecoder(fields, values);
    });

    it('should decode main fixed tuple with fixed values', async () => {
      const fields: utils.TupleField = {
        name: 'MainFixedTuple',
        type: 'tuple[2]',
        components: [
          { name: 'id', type: 'uint256', size: 256 },
          {
            name: 'data',
            type: 'bytes16',
            size: 128,
          },
        ],
      };
      const values = [
        [1, ethers.hexlify(ethers.randomBytes(16))],
        [2, ethers.hexlify(ethers.randomBytes(16))],
      ];

      await testDecoder(fields, values);
    });

    it('should decode main dynamic tuple with dynamic values', async () => {
      const fields: utils.TupleField = {
        name: 'MainDynamicTuple',
        type: 'tuple[]',
        components: [
          { name: 'id', type: 'uint256', size: 256 },
          { name: 'name', type: 'string' },
          {
            name: 'uint32Array',
            type: 'uint16[]',
            size: 16,
          },
        ],
      };
      const values = [
        [1, 'Main Item 1', [1, 2]],
        [2, 'Main Item 2', [3, 4, 5]],
      ];

      await testDecoder(fields, values);
    });

    it('should decode main dynamic tuple with fixed values', async () => {
      const fields: utils.TupleField = {
        name: 'MainDynamicTuple',
        type: 'tuple[]',
        components: [
          { name: 'id', type: 'uint256', size: 256 },
          {
            name: 'data',
            type: 'bytes16',
            size: 128,
          },
        ],
      };
      const values = [
        [123, ethers.hexlify(ethers.randomBytes(16))],
        [456, ethers.hexlify(ethers.randomBytes(16))],
      ];

      await testDecoder(fields, values);
    });
  });
});
