import fs from 'fs/promises';
import ejs from 'ejs';
import * as prettier from 'prettier/standalone';
import solidityPlugin from 'prettier-plugin-solidity';

import { sszSchema } from './utils';
import { Schema, TupleField, organizeFieldsIntoStructs } from '../utils';
import { generateDecoderLines } from './helpers';
import { calculateFieldShift, expandFields } from '../encode-packed/utils';

export const generateDecoder = async (
  templatePath: string,
  tempFilePath: string,
  fields: TupleField,
) => {
  const schema: Schema[] = await sszSchema(fields);
  console.log('==>> schema', JSON.stringify(schema, null, 2));
  const template = await fs.readFile(templatePath, 'utf-8');

  const structs = organizeFieldsIntoStructs(fields);
  const expandedFields = calculateFieldShift(expandFields([fields])).flat();

  console.log('shifted', JSON.stringify(expandedFields, null, 2));

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

  // console.log('generatedCode', generatedCode);
  // return;

  const formattedCode = await prettier.format(generatedCode, {
    parser: 'solidity-parse',
    plugins: [solidityPlugin],
    printWidth: 80,
    tabWidth: 2,
    useTabs: false,
    singleQuote: false,
    bracketSpacing: false,
  });
  await fs.writeFile(tempFilePath, formattedCode, 'utf-8');
};
