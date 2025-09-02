import fs from 'fs/promises';

import ejs from 'ejs';
import * as prettier from 'prettier/standalone';
import solidityPlugin from 'prettier-plugin-solidity';

import type { EvmVersion, TupleField } from '../utils';
import { organizeFieldsIntoStructs } from '../utils';

import { generateDecoderLines } from './helpers';
import {
  calculateFieldShift,
  checkForDynamicData,
  expandFields,
} from './utils';

export const generateDecoder = async (
  template: string,
  fields: TupleField,
  evmVersion: EvmVersion = 'cancun',
) => {
  const structs = organizeFieldsIntoStructs(fields);
  const expandedFields = calculateFieldShift(expandFields([fields])).flat();

  const mainStructName =
    '_' + fields.name.charAt(0).toLowerCase() + fields.name.slice(1);
  const isMainStructDynamic = fields.type.endsWith('[]');
  const returnType =
    fields.name + (fields.type.match(/\[(\d*)\]/g) || []).join('');
  const generatedLines = generateDecoderLines(
    expandedFields,
    mainStructName,
    isMainStructDynamic,
    evmVersion,
  );

  const generatedCode = ejs.render(
    template,
    {
      lines: generatedLines,
      structs,
      mainStructName,
      isMainStructDynamic,
      returnType,
      containsDynamicData: checkForDynamicData(expandedFields),
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
