import fs from 'fs/promises';
import { exec } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

import { expect } from 'chai';
import type { BaseContract } from 'ethers';
import hre, { ethers, run } from 'hardhat';

import type { DecoderContract } from '../src';
import { encodeSSZData, generateSSZDecoder } from '../src';
import { toUpperFirstLetter } from '../src/ssz/utils';
import type { EvmVersion, PrimitiveField, TupleField } from '../src/utils';
import { toUpperFirstLetter } from '../src/utils';

const execPromise = promisify(exec);

describe('Template Multi Decoder', () => {
  const evmVersion = (process.env.EVM_VERSION || 'cancun') as EvmVersion;
  const ssz = {
    contractName: 'SSZDecoder',
    templatePath: path.join(__dirname, '../src/ssz/decoder.sol.ejs'),
    subTemplatePath: path.join(
      __dirname,
      '../src/ssz/sub-decoder/subdecoder.sol.ejs',
    ),
    tempFilePath: path.join(__dirname, '../contracts/'),
  };

  let contractPaths: string[] = [];

  before(function () {
    hre.config.solidity.compilers[0].settings.evmVersion = evmVersion;
  });

  beforeEach(() => {
    contractPaths.length = 0;
  });

  async function generateAndDeployDecoders(fields: TupleField) {
    // Check if `contracts` directory exists, if not create it
    const contractsDir = path.join(__dirname, '../contracts/');
    if (!(await fs.stat(contractsDir).catch(() => false))) {
      await fs.mkdir(contractsDir, { recursive: true });
    }

    const templateSSZ = await fs.readFile(ssz.templatePath, 'utf-8');
    const subTemplateSSZ = await fs.readFile(ssz.subTemplatePath, 'utf-8');

    const code = await generateSSZDecoder(
      templateSSZ,
      subTemplateSSZ,
      fields,
      evmVersion,
    );
    if (typeof code === 'string') {
      contractPaths = [ssz.tempFilePath + '.sol'];
      await fs.writeFile(contractPaths[0], code, 'utf-8');
    } else {
      for (const c of Object.keys(code)) {
        const contractPath = ssz.tempFilePath + c + ssz.contractName + '.sol';
        contractPaths.push(contractPath);
        await fs.writeFile(contractPath, code[c], 'utf-8');
      }
    }

    await run('compile');

    const DecoderFactorySSZ = await ethers.getContractFactory(
      fields.name + ssz.contractName,
    );
    return {
      decoderSSZ:
        (await DecoderFactorySSZ.deploy()) as unknown as BaseContract &
          DecoderContract,
    };
  }

  async function testDecoder(
    fields: TupleField,
    values: any[],
    witOptions?: {
      witFile: string;
      jsonFile: string;
      world?: string;
      function?: string;
    },
  ) {
    if (witOptions) {
      const args = [
        '--input',
        path.join(__dirname, witOptions.witFile),
        '--output',
        path.join(__dirname, witOptions.jsonFile),
      ];
      if (witOptions.world) {
        args.push('--world', witOptions.world);
      }
      if (witOptions.function) {
        args.push('--function', witOptions.function);
      }
      // WIT to JSON conversion
      await execPromise(`cargo run --bin wit-converter -- ${args.join(' ')}`, {
        cwd: path.join(__dirname, '../../../../apps/wit-converter'),
      });

      const data = await fs.readFile(
        path.join(__dirname, witOptions.jsonFile),
        'utf-8',
      );

      const jsonData = JSON.parse(data);
      const witToJsonData = expandJsonFields(
        jsonData.payloadTypeName,
        jsonData.types,
      )[fields.name];

      expect(jsonData.payloadTypeName).to.be.equal(fields.name);
      expect(witToJsonData).to.deep.equal(fields);
    }

    // SSZ multi decoder
    const sszData = await encodeSSZData(fields, values);

    const { decoderSSZ } = await generateAndDeployDecoders(fields);

    const res = await decoderSSZ.decode(sszData);
    const receipt = await res.wait();
    const events = receipt!.logs
      .map(log => decoderSSZ.interface.parseLog(log))
      .filter(e => e!.name !== 'Union');

    // Recursively find all union components and their corresponding values
    function checkUnionComponents(
      field: TupleField | PrimitiveField,
      value: any,
    ): any {
      if (field.type.includes('union') && 'components' in field) {
        const flatVal = (value: any): any => {
          if (Array.isArray(value)) {
            return value.flatMap((v: any) => flatVal(v));
          } else if (
            value &&
            typeof value === 'object' &&
            typeof value.value === 'object' &&
            value.value &&
            !Array.isArray(value.value)
          ) {
            return flatVal(value.value);
          }
          return value;
        };
        return flatVal(value);
      } else if ('components' in field && Array.isArray(value)) {
        return field.components.flatMap((c, i) =>
          checkUnionComponents(c, value[i]),
        );
      }
      return [];
    }

    const vals = checkUnionComponents(fields, values);
    for (const [i, event] of events.entries()) {
      if (event) {
        let type = event.fragment.inputs[0]?.type || '';
        const arrayDimensions = type.match(/(\[\d*\])+$/);
        if (arrayDimensions) {
          type = toUpperFirstLetter(type.replace(arrayDimensions[0], ''));
        }

        expect(event).to.not.equal(undefined);
        expect(event!.args).to.not.equal(undefined);
        if (type === '' && !vals![i].value) {
          expect(event!.args).to.deep.equal([]);
        } else {
          expect(event!.args).to.deep.equal([vals![i].value]);
        }
      }
    }
  }

  afterEach(async () => {
    for (const contractPath of contractPaths) {
      // Clean up generated contract files
      await fs.rm(contractPath, { force: true });
    }

    // Clean up WIT JSON files if they were created
    const jsonFiles = await fs.readdir(path.join(__dirname, 'wit'));
    await Promise.all(
      jsonFiles
        .filter(file => file.endsWith('.json'))
        .map(
          async file =>
            await fs.rm(path.join(__dirname, 'wit', file), { force: true }),
        ),
    );
  });

  it('[WIT] should test union null value', async () => {
    const fields: TupleField = {
      name: 'Test',
      type: 'tuple',
      components: [
        {
          name: 'union',
          type: 'union',
          components: [
            { name: 'none', type: 'none', size: 0 },
            { name: 'integer', type: 'uint32', size: 32 },
            { name: 'str1', type: 'string' },
            {
              name: 'struct2',
              type: 'tuple',
              components: [{ name: 'str2', type: 'string[]' }],
            },
          ],
        },
      ],
    };

    const values = [{ selector: 0, value: null }];

    await testDecoder(fields, values, {
      witFile: 'wit/union-null-value.wit',
      jsonFile: 'wit/union-null-value.json',
    });
  });

  it('[WIT] should test union uint32 value', async () => {
    const fields: TupleField = {
      name: 'Test',
      type: 'tuple',
      components: [
        {
          name: 'union',
          type: 'union',
          components: [
            { name: 'none', type: 'none', size: 0 },
            { name: 'integer', type: 'uint32', size: 32 },
            { name: 'str1', type: 'string' },
            {
              name: 'struct2',
              type: 'tuple',
              components: [{ name: 'str2', type: 'string[]' }],
            },
          ],
        },
      ],
    };

    const values = [{ selector: 1, value: 4 }];

    await testDecoder(fields, values, {
      witFile: 'wit/union-null-value.wit',
      jsonFile: 'wit/union-null-value.json',
    });
  });

  it('[WIT] should test union string value', async () => {
    const fields: TupleField = {
      name: 'Test',
      type: 'tuple',
      components: [
        {
          name: 'union',
          type: 'union',
          components: [
            { name: 'none', type: 'none', size: 0 },
            { name: 'integer', type: 'uint32', size: 32 },
            { name: 'str1', type: 'string' },
            {
              name: 'struct2',
              type: 'tuple',
              components: [{ name: 'str2', type: 'string[]' }],
            },
          ],
        },
      ],
    };

    const values = [{ selector: 2, value: 'abc' }];

    await testDecoder(fields, values, {
      witFile: 'wit/union-null-value.wit',
      jsonFile: 'wit/union-null-value.json',
    });
  });

  it('[WIT] should test union tuple value', async () => {
    const fields: TupleField = {
      name: 'Test',
      type: 'tuple',
      components: [
        {
          name: 'union',
          type: 'union',
          components: [
            { name: 'none', type: 'none', size: 0 },
            { name: 'integer', type: 'uint32', size: 32 },
            { name: 'str1', type: 'string' },
            {
              name: 'struct2',
              type: 'tuple',
              components: [{ name: 'str2', type: 'string[]' }],
            },
          ],
        },
      ],
    };

    const values = [{ selector: 3, value: [['abc', 'yabadabadu']] }];

    await testDecoder(fields, values, {
      witFile: 'wit/union-null-value.wit',
      jsonFile: 'wit/union-null-value.json',
    });
  });

  it('[WIT] should test nested multidimensional union value', async () => {
    const fields: TupleField = {
      name: 'Test',
      type: 'tuple',
      components: [
        {
          name: 'str',
          type: 'tuple',
          components: [
            { name: 'string1', type: 'string' },
            {
              name: 'union',
              type: 'union[][2]',
              components: [
                { name: 'none', type: 'none', size: 0 },
                { name: 'integer', type: 'uint32', size: 32 },
                { name: 'string2', type: 'string' },
              ],
            },
          ],
        },
      ],
    };

    const values = [
      [
        'abc',
        [
          [
            { selector: 2, value: 'as' },
            { selector: 0, value: null },
          ],
          [{ selector: 1, value: 2 }],
        ],
      ],
    ];

    await testDecoder(fields, values, {
      witFile: 'wit/nested-multidimensional-union.wit',
      jsonFile: 'wit/nested-multidimensional-union.json',
    });
  });

  it('[WIT] should test nested tuples union value with same name', async () => {
    const fields: TupleField = {
      name: 'Test',
      type: 'tuple',
      components: [
        {
          name: 't1',
          type: 'tuple',
          components: [
            {
              name: 'unionValue',
              type: 'union',
              components: [
                { name: 'none', type: 'none', size: 0 },
                { name: 'integer', type: 'uint32', size: 32 },
                {
                  name: 'tuple1',
                  type: 'tuple',
                  components: [{ name: 'a', type: 'uint8', size: 8 }],
                },
              ],
            },
          ],
        },
        {
          name: 't2',
          type: 'tuple',
          components: [
            {
              name: 'unionValue',
              type: 'union',
              components: [
                { name: 'integer', type: 'uint8', size: 8 },
                { name: 'str', type: 'string' },
                {
                  name: 'tuple1',
                  type: 'tuple',
                  components: [{ name: 'b', type: 'uint32', size: 32 }],
                },
              ],
            },
          ],
        },
      ],
    };

    const values = [[{ selector: 1, value: 2 }], [{ selector: 2, value: [9] }]];

    await testDecoder(fields, values, {
      witFile: 'wit/nested-tuples-union-same-name.wit',
      jsonFile: 'wit/nested-tuples-union-same-name.json',
    });
  });

  it('should test dynamic nested array union', async () => {
    const fields: TupleField = {
      name: 'Test',
      type: 'tuple[][1]',
      components: [
        {
          name: 'union',
          type: 'union[]',
          components: [
            {
              name: 'none',
              type: 'none',
              size: 0,
            },
            {
              name: 'struct2',
              type: 'tuple[2]',
              components: [{ name: 'str2', type: 'string[]' }],
            },
            {
              name: 'uint8Var',
              type: 'uint8',
              size: 8,
            },
          ],
        },
      ],
    };

    const values = [
      [
        [
          [
            { selector: 0, value: null },
            {
              selector: 1,
              value: [[['a', 'b', 'c']], [['abc', 'def']]],
            },
            {
              selector: 2,
              value: 5,
            },
          ],
        ],
        [
          [
            {
              selector: 1,
              value: [[['a', 'b']], [['abc', 'def']]],
            },
            {
              selector: 1,
              value: [[['a1', 'b2', 'c3']], [['def']]],
            },
            {
              selector: 0,
              value: null,
            },
          ],
        ],
      ],
    ];

    await testDecoder(fields, values);
  });

  it('[WIT] should test nested union', async () => {
    const fields: TupleField = {
      name: 'Test',
      type: 'tuple',
      components: [
        {
          name: 'union',
          type: 'union[]',
          components: [
            { name: 'none', type: 'none', size: 0 },
            { name: 'integer', type: 'uint32', size: 32 },
            {
              name: 'union2',
              type: 'union',
              components: [
                { name: 'str2', type: 'string[]' },
                { name: 'uint8Val', type: 'uint8', size: 8 },
              ],
            },
          ],
        },
      ],
    };

    const values = [
      [
        { selector: 0, value: null },
        { selector: 1, value: 3 },
        { selector: 2, value: { selector: 1, value: 5 } },
      ],
    ];

    await testDecoder(fields, values, {
      witFile: 'wit/nested-union.wit',
      jsonFile: 'wit/nested-union.json',
    });
  });

  it('[WIT] should test same name union in nested tuples', async () => {
    const fields: TupleField = {
      name: 'MainTuple',
      type: 'tuple',
      components: [
        {
          name: 'union1Value',
          type: 'union',
          components: [
            { name: 'none', type: 'none', size: 0 },
            { name: 'integer', type: 'uint32', size: 32 },
          ],
        },
        {
          name: 'tupleValue',
          type: 'tuple',
          components: [
            {
              name: 'union2Value',
              type: 'union',
              components: [
                { name: 'none', type: 'none', size: 0 },
                { name: 'integer', type: 'uint32', size: 32 },
              ],
            },
          ],
        },
      ],
    };

    const values = [{ selector: 0, value: null }, [{ selector: 1, value: 4 }]];

    await testDecoder(fields, values, {
      witFile: 'wit/same-name-union-in-nested-tuples.wit',
      jsonFile: 'wit/same-name-union-in-nested-tuples.json',
    });
  });

  it('[WIT] should test dynamic union', async () => {
    const fields: TupleField = {
      name: 'Test',
      type: 'tuple',
      components: [
        {
          name: 'union1',
          type: 'union[]',
          components: [
            {
              name: 'none',
              type: 'none',
              size: 0,
            },
            {
              name: 'struct2',
              type: 'tuple[]',
              components: [{ name: 'str2', type: 'string[]' }],
            },
            {
              name: 'uint8Var',
              type: 'uint8',
              size: 8,
            },
          ],
        },
      ],
    };

    const values = [
      [
        { selector: 0, value: null },
        {
          selector: 1,
          value: [[['a', 'b', 'c']], [['abc', 'def']]],
        },
        {
          selector: 2,
          value: 5,
        },
      ],
    ];

    await testDecoder(fields, values, {
      witFile: 'wit/dynamic-union.wit',
      jsonFile: 'wit/dynamic-union.json',
    });
  });

  it('[WIT] should ignore error tuple in WIT world', async () => {
    const fields: TupleField = {
      name: 'Test',
      type: 'tuple',
      components: [
        {
          name: 'union1',
          type: 'union[]',
          components: [
            {
              name: 'none',
              type: 'none',
              size: 0,
            },
            {
              name: 'struct2',
              type: 'tuple[]',
              components: [{ name: 'str2', type: 'string[]' }],
            },
            {
              name: 'uint8Var',
              type: 'uint8',
              size: 8,
            },
          ],
        },
      ],
    };

    const values = [
      [
        { selector: 0, value: null },
        {
          selector: 1,
          value: [[['a', 'b', 'c']], [['abc', 'def']]],
        },
        {
          selector: 2,
          value: 5,
        },
      ],
    ];

    await testDecoder(fields, values, {
      witFile: 'wit/ignore-error-tuple.wit',
      jsonFile: 'wit/ignore-error-tuple.json',
    });
  });

  it('[WIT] should test with different WIT world and function names', async () => {
    const fields: TupleField = {
      name: 'Input',
      type: 'tuple',
      components: [
        {
          name: 'union',
          type: 'union',
          components: [
            { name: 'none', type: 'none', size: 0 },
            { name: 'uint8Var', type: 'uint8', size: 8 },
          ],
        },
      ],
    };

    const values = [{ selector: 0, value: null }];

    await testDecoder(fields, values, {
      witFile: 'wit/different-names.wit',
      jsonFile: 'wit/different-names.json',
      world: 'gaia',
      function: 'calculate',
    });
  });
});
