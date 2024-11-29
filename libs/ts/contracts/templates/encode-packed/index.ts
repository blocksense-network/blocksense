import fs from 'fs/promises';
import ejs from 'ejs';
import * as prettier from 'prettier/standalone';
import solidityPlugin from 'prettier-plugin-solidity';

import {
  calculateFieldShift,
  expandFields,
  helpers,
  organizeFieldsIntoStructs,
  TupleField,
} from './utils';
import { generateDecoderLines } from './helpers';

export const generateDecoder = async (
  templatePath: string,
  tempFilePath: string,
  fields: TupleField,
) => {
  const template = await fs.readFile(templatePath, 'utf-8');

  const structs = organizeFieldsIntoStructs(fields);
  const expandedFields = calculateFieldShift(expandFields([fields])).flat();

  const mainStructName =
    fields.name.charAt(0).toLowerCase() + fields.name.slice(1);
  const isMainStructDynamic = fields.type.endsWith('[]');
  const returnType =
    fields.name + (fields.type.match(/\[(\d*)\]/g) || []).join('');
  const generatedLines = generateDecoderLines(
    expandedFields,
    mainStructName,
    isMainStructDynamic,
  );

  const generatedCode = ejs.render(
    template,
    {
      lines: generatedLines,
      structs,
      mainStructName,
      isMainStructDynamic,
      returnType,
      containsDynamicData: helpers.checkForDynamicData(expandedFields),
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
  await fs.writeFile(tempFilePath, formattedCode, 'utf-8');
};
