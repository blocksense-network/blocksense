import { expect } from 'chai';
import { ethers } from 'hardhat';
import fs from 'fs';
import path from 'path';
import ejs from 'ejs';
import { run } from 'hardhat';

type SimpleField = {
  name: string;
  type: string;
  size?: number;
};

type TupleField = {
  name: string;
  type: string;
  components: (SimpleField | TupleField)[];
};

interface Field {
  name: string;
  values: (SimpleField | TupleField)[];
}

function processFields(
  fields: Field['values'],
  values: any[],
): [Field['values'], any[]] {
  const processedFields = fields.map((field, i) => {
    if (field.type.includes('[')) {
      const dimensions = field.type
        .split('[')
        .slice(1)
        .map(dim => dim.replace(']', ''));
      const baseType = field.type.split('[')[0];

      const processArray = (arr: any[], dims: string[]): any => {
        if (dims.length === 0) {
          if (['string', 'bytes'].includes(baseType)) {
            return processStringOrBytes(arr);
          } else if ('components' in field) {
            const [processedComponents, processedValues] = processFields(
              field.components,
              arr,
            );
            return ethers.solidityPacked(
              processedComponents.map(component => component.type),
              processedValues,
            );
          } else {
            return ethers.solidityPacked([baseType], [arr]);
          }
        }

        const currentDim = dims[dims.length - 1];
        const remainingDims = dims.slice(0, -1);
        const isCurrentDimDynamic = currentDim === '';

        if (isCurrentDimDynamic) {
          const arrayLength = ethers.solidityPacked(['uint32'], [arr.length]);
          const processedSubArrays = arr.map(subArr =>
            processArray(subArr, remainingDims),
          );
          return ethers.concat([arrayLength, ...processedSubArrays]);
        } else {
          return ethers.concat(
            arr.map(subArr => processArray(subArr, remainingDims)),
          );
        }
      };

      values[i] = processArray(values[i], dimensions);
      return { ...field, type: 'bytes' };
    } else if (['string', 'bytes'].includes(field.type)) {
      values[i] = processStringOrBytes(values[i]);
      return { ...field, type: 'bytes' };
    } else if ('components' in field) {
      const [processedComponents, processedValues] = processFields(
        field.components,
        values[i],
      );
      values[i] = ethers.solidityPacked(
        processedComponents.map(component => component.type),
        processedValues,
      );
      return { ...field, type: 'bytes', components: processedComponents };
    }
    return field;
  });

  return [processedFields, values];
}

function processStringOrBytes(value: any): string {
  const data = ethers.isBytesLike(value)
    ? value
    : ethers.hexlify(ethers.toUtf8Bytes(value));
  const dataLength = ethers.solidityPacked(['uint32'], [(data.length - 2) / 2]);
  return ethers.concat([dataLength, data]);
}

describe('Decoder', () => {
  const contractName = 'Decoder';
  const templatePath = path.join(__dirname, '../templates/decoder.sol.ejs');
  const tempFilePath = path.join(__dirname, `../contracts/${contractName}.sol`);

  async function generateAndDeployDecoder(fields: Field) {
    const template = fs.readFileSync(templatePath, 'utf-8');
    const generatedCode = ejs.render(template, { fields });
    fs.writeFileSync(tempFilePath, generatedCode, 'utf-8');

    await run('compile');

    const DecoderFactory = await ethers.getContractFactory(contractName);
    return await DecoderFactory.deploy();
  }

  async function testDecoder(fields: Field, values: any[]) {
    const decoder = await generateAndDeployDecoder(fields);
    const clone = (items: any) =>
      items.map((item: any) => (Array.isArray(item) ? clone(item) : item));
    const compareValues = clone(values);

    const [processedFields, processedValues] = processFields(
      fields.values,
      values,
    );
    fields.values = processedFields;
    values = processedValues;
    const packedData = ethers.solidityPacked(
      fields.values.map(field => field.type),
      values,
    );
    const result: any = await decoder.decode(packedData);
    expect(result).to.deep.equal(compareValues);
  }

  afterEach(async () => {
    if (fs.existsSync(tempFilePath)) {
      fs.rmSync(tempFilePath, { force: true });
    }
  });

  it('should correctly decode packed sports data with boolean fields', async () => {
    const fields = {
      name: 'GameData',
      values: [
        { name: 'isHomeTeam', type: 'bool', size: 8 },
        { name: 'isOvertime', type: 'bool', size: 8 },
        { name: 'score', type: 'uint16', size: 16 },
      ],
    };
    const values = [true, false, 100];
    await testDecoder(fields, values);
  });

  it('should correctly decode packed sports data with mixed field types and sizes', async () => {
    const fields = {
      name: 'GameData',
      values: [
        { name: 'gameId', type: 'uint32', size: 32 },
        { name: 'teamName', type: 'bytes32', size: 256 },
        { name: 'playerCount', type: 'uint8', size: 8 },
      ],
    };
    const values = [12345, ethers.encodeBytes32String('TeamA'), 11];
    await testDecoder(fields, values);
  });

  it('should handle maximum values for each field type', async () => {
    const fields = {
      name: 'MaxValues',
      values: [
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
    const fields = {
      name: 'MixedFields',
      values: [
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
    const fields = {
      name: 'MaxSportsData',
      values: [
        { name: 'maxUint8', type: 'uint8', size: 8 },
        { name: 'maxUint16', type: 'uint16', size: 16 },
        { name: 'maxUint32', type: 'uint32', size: 32 },
      ],
    };
    const values = [255, 65535, 4294967295];
    await testDecoder(fields, values);
  });

  it('should handle different int sizes and address', async () => {
    const fields = {
      name: 'IntAndAddress',
      values: [
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
    const fields = {
      name: 'BytesSizes',
      values: [
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
    const fields = {
      name: 'ComplexStruct',
      values: [
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
    const fields = {
      name: 'MixedWithNegatives',
      values: [
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
    const fields = {
      name: 'LargeUintSmallBytes',
      values: [
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
    const fields = {
      name: 'MultiAddressMixedInts',
      values: [
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
    const fields = {
      name: 'MixedTypes',
      values: [
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
    const fields = {
      name: 'FixedArraysAndLargeInts',
      values: [
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
    const fields = {
      name: 'MixedFixedArrays',
      values: [
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
    const fields = {
      name: 'MixedTypesWithArrays',
      values: [
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
    const fields = {
      name: 'LargeArraysWithMixedTypes',
      values: [
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

  it('should handle nested structs', async () => {
    const fields: Field = {
      name: 'NestedStructs',
      values: [
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
    const fields: Field = {
      name: 'NestedStructsWithArrays',
      values: [
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
    const fields: Field = {
      name: 'StructFixedArray',
      values: [
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
    const fields: Field = {
      name: 'StructWithArraysOfNestedStructs',
      values: [
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

  it('should handle dynamic array with different data types', async () => {
    const fields: Field = {
      name: 'DynamicArrayWithUint8Array',
      values: [
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

  it('should handle dynamic array of addresses', async () => {
    const fields: Field = {
      name: 'DynamicArrayOfAddresses',
      values: [
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
    const fields: Field = {
      name: 'DynamicArrayOfBooleans',
      values: [
        { name: 'boolArray', type: 'bool[]', size: 8 },
        { name: 'uint64Value', type: 'uint64', size: 64 },
      ],
    };
    const values = [[true, false, true, true, false], BigInt('12345678901234')];
    await testDecoder(fields, values);
  });

  it('should handle dynamic array of bytes', async () => {
    const fields: Field = {
      name: 'DynamicArrayOfBytes',
      values: [
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
    const fields: Field = {
      name: 'DynamicUint256Array',
      values: [
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

  it('should handle nested fixed arrays', async () => {
    const fields: Field = {
      name: 'NestedDynamicArrays',
      values: [
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
    const fields: Field = {
      name: 'TwoDimensionalFixedArray',
      values: [
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
    const fields: Field = {
      name: 'ThreeDimensionalFixedArray',
      values: [
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
    const fields: Field = {
      name: 'FourDimensionalFixedArray',
      values: [
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
    const fields: Field = {
      name: 'TwoDimensionalStructArray',
      values: [
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

  it('should handle string and bytes', async () => {
    const fields: Field = {
      name: 'StringField',
      values: [
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
    const fields: Field = {
      name: 'FixedArrayField',
      values: [
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
    const fields: Field = {
      name: 'StructField',
      values: [
        {
          name: 'structValue',
          type: 'tuple',
          components: [
            {
              name: 'bytesField',
              type: 'bytes',
            },
            {
              name: 'stringField',
              type: 'string',
            },
            {
              name: 'uint16Field',
              type: 'uint16',
              size: 16,
            },
          ],
        },
      ],
    };
    const values = [
      [
        ethers.hexlify(ethers.randomBytes(50)),
        'This is a string inside a struct',
        42,
      ],
    ];
    await testDecoder(fields, values);
  });

  it('should handle dynamic array of string and bytes', async () => {
    const fields: Field = {
      name: 'DynamicArrayField',
      values: [
        {
          name: 'dynamicStringArray',
          type: 'string[]',
        },
        {
          name: 'dynamicBytesArray',
          type: 'bytes[]',
        },
      ],
    };
    const values = [
      ['String 1', 'String 2', 'String 3 with more data'],
      [
        ethers.hexlify(ethers.randomBytes(10)),
        ethers.hexlify(ethers.randomBytes(20)),
        ethers.hexlify(ethers.randomBytes(30)),
        ethers.hexlify(ethers.randomBytes(40)),
      ],
    ];
    await testDecoder(fields, values);
  });

  it('should handle struct with array of bytes and string', async () => {
    const fields: Field = {
      name: 'StructWithArrays',
      values: [
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
      ],
    ];
    await testDecoder(fields, values);
  });

  it('should decode n-dimensional dynamic arrays', async () => {
    const fields: Field = {
      name: 'NDimensionalArrays',
      values: [
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
    const fields: Field = {
      name: 'MultidimensionalMixedArrays',
      values: [
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
    const fields: Field = {
      name: 'MixedArrayTypes',
      values: [
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
    const fields: Field = {
      name: 'ComplexNestedArrays',
      values: [
        {
          name: 'nestedArray',
          type: 'uint256[2][][3][]',
          size: 256,
        },
        {
          name: 'mixedTypeArray',
          type: 'string[2][][3]',
        },
      ],
    };
    const values = [
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
    ];
    await testDecoder(fields, values);
  });
});
