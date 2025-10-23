import fs from 'fs/promises';

import ejs from 'ejs';
import * as prettier from 'prettier/standalone';
import solidityPlugin from 'prettier-plugin-solidity';

import type { EvmVersion, TupleField } from '../utils';
import {
  organizeFieldsIntoStructs,
  toLowerFirstLetter,
  toUpperFirstLetter,
} from '../utils';

import { generateDecoderLines } from './helpers';
import { generateSubDecoderLines } from './sub-decoder';
import { sszSchema } from './utils';

export const generateDecoder = async (
  template: string,
  subTemplate: string,
  fields: TupleField,
  evmVersion: EvmVersion = 'cancun',
  start: number = 0,
): Promise<string | Record<string, string>> => {
  const { schema, unionTypes } = await sszSchema(fields);

  const { structs, unionStructs } = organizeFieldsIntoStructs(fields);
  const mainStructName = '_' + toLowerFirstLetter(fields.name);
  const isMainStructDynamic = fields.type.endsWith('[]');
  const returnType =
    fields.name + (fields.type.match(/\[(\d*)\]/g) || []).join('');

  unionTypes.forEach(type => {
    if (!type.structNames || type.structNames[0] === '') {
      type.structNames = [mainStructName, ...(type.structNames || []).slice(1)];
    }
  });

  const decoderName = 'SSZDecoder';
  const mainGeneratedLines = generateDecoderLines(
    schema[0],
    mainStructName,
    evmVersion,
    start,
  );
  let subDecoderGeneratedLines: string[] = [];
  if (unionTypes) {
    subDecoderGeneratedLines = generateSubDecoderLines(
      decoderName,
      mainStructName,
      structs,
      unionTypes,
      returnType,
    );
  }

  const generatedCode = ejs.render(
    template,
    {
      decoderName,
      lines: mainGeneratedLines,
      structs,
      mainStructName,
      isMainStructDynamic,
      returnType,
      unionTypes,
      toUpperFirstLetter,
      subDecoderLines: subDecoderGeneratedLines,
    },
    {
      root: (await fs.realpath(__dirname)) + '/',
    },
  );

  const mainCode = await formatCode(generatedCode);
  if (!unionTypes.length) {
    return mainCode;
  }

  // Multidecoder
  const code: Record<string, string> = {
    [toUpperFirstLetter(fields.name)]: mainCode,
  };

  for (const ut of unionTypes) {
    const utfLines: string[][] = [];
    for (const utf of ut.fields || []) {
      utfLines.push(generateDecoderLines(utf, utf.fieldName, evmVersion, 1));
    }
    const unionName = 'SSZ' + '_' + ut.contractName;
    const unionType = ejs.render(
      subTemplate,
      {
        lines: utfLines,
        structs: unionStructs[ut.contractName] || [],
        isMainStructDynamic: false,
        unionName,
        unionTypes: ut.fields,
        toUpperFirstLetter,
      },
      {
        root: (await fs.realpath(__dirname)) + '/',
      },
    );

    code[unionName] = await formatCode(unionType);
  }

  return code;
};

const formatCode = async (generatedCode: string) => {
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
