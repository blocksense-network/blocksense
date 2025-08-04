import fs from 'fs/promises';
import ejs from 'ejs';
import * as prettier from 'prettier/standalone';
import solidityPlugin from 'prettier-plugin-solidity';

import { Schema, sszSchema } from './utils';
import { TupleField, organizeFieldsIntoStructs } from '../utils';
import { generateDecoderLines } from './helpers';

export const generateDecoder = async (template: string, fields: TupleField) => {
  const schema: Schema[] = await sszSchema(fields);

  const structs = organizeFieldsIntoStructs(fields);
  const mainStructName =
    fields.name.charAt(0).toLowerCase() + fields.name.slice(1);
  const isMainStructDynamic = fields.type.endsWith('[]');
  const returnType =
    fields.name + (fields.type.match(/\[(\d*)\]/g) || []).join('');
  const generatedLines = generateDecoderLines(schema[0], mainStructName);

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
