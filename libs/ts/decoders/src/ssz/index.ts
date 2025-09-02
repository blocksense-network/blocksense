import fs from 'fs/promises';

import ejs from 'ejs';
import * as prettier from 'prettier/standalone';
import solidityPlugin from 'prettier-plugin-solidity';

import type { EvmVersion, TupleField } from '../utils';
import { organizeFieldsIntoStructs } from '../utils';

import { generateDecoderLines } from './helpers';
import type { Schema } from './utils';
import { sszSchema } from './utils';

export const generateDecoder = async (
  template: string,
  fields: TupleField,
  evmVersion: EvmVersion = 'cancun',
  start: number = 0,
) => {
  const schema: Schema[] = await sszSchema(fields);

  const structs = organizeFieldsIntoStructs(fields);
  const mainStructName =
    '_' + fields.name.charAt(0).toLowerCase() + fields.name.slice(1);
  const isMainStructDynamic = fields.type.endsWith('[]');
  const returnType =
    fields.name + (fields.type.match(/\[(\d*)\]/g) || []).join('');
  const generatedLines = generateDecoderLines(
    schema[0],
    mainStructName,
    evmVersion,
    start,
  );

  const generatedCode = ejs.render(
    template,
    {
      lines: generatedLines,
      structs,
      mainStructName,
      isMainStructDynamic,
      returnType,
    },
    {
      root: (await fs.realpath(__dirname)) + '/',
    },
  );

  const formattedCode = await prettier.format(generatedCode, {
    parser: 'solidity-parse',
    plugins: [solidityPlugin],
    printWidth: 80,
    tabWidth: 2,
    useTabs: false,
    singleQuote: false,
    bracketSpacing: false,
  });

  return formattedCode;
};
