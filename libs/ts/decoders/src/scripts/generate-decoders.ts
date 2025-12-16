import fs from 'fs/promises';
import { EvmVersion, TupleField } from '../utils/types';
import path from 'node:path';
import { generateEPDecoder, generateSSZDecoder } from '../';
import { rootDir } from '@blocksense/base-utils';

export const generateDecoders = async (
  type: 'ssz' | 'encode-packed',
  evmVersion: EvmVersion,
  outputDir: string,
  fields: TupleField,
  options?: {
    templatePath?: string;
    subTemplatePath?: string;
    contractName?: string;
    containsUnion?: boolean;
    stride?: number;
  },
) => {
  const defaultOptions = {
    templatePath: path.join(
      rootDir,
      type === 'encode-packed'
        ? 'libs/ts/decoders/src/encode-packed/decoder.sol.ejs'
        : 'libs/ts/decoders/src/ssz/decoder.sol.ejs',
    ),
    subTemplatePath: path.join(
      rootDir,
      'libs/ts/decoders/src/ssz/sub-decoder/subdecoder.sol.ejs',
    ),
    contractName: 'SSZDecoder',
    containsUnion: false,
  };

  const opts = { ...defaultOptions, ...options };

  let contractPaths: string[] = [];
  await fs.mkdir(outputDir, { recursive: true });

  const template = await fs.readFile(opts.templatePath, 'utf-8');
  const subTemplateSSZ = opts.containsUnion
    ? await fs.readFile(opts.subTemplatePath, 'utf-8')
    : '';

  // In how many bytes will the prefix length (size of the data) be stored
  // 32 * 2^(stride) bytes
  // e.g. stride 0 -> 32 bytes -> 1 prefix byte
  //      stride 2 -> 128 bytes -> 1 prefix byte
  //      stride 3 -> 256 bytes -> 2 prefix bytes
  const prefixSize = opts.stride ? Math.ceil((opts.stride + 5) / 8) : undefined;

  const code =
    type === 'encode-packed'
      ? await generateEPDecoder(template, fields, evmVersion)
      : await generateSSZDecoder(
          template,
          subTemplateSSZ,
          fields,
          evmVersion,
          prefixSize,
          !!prefixSize,
        );

  if (typeof code === 'string') {
    contractPaths.push(path.join(outputDir, opts.contractName + '.sol'));
    await fs.writeFile(contractPaths[0], code, 'utf-8');
  } else {
    for (const c of Object.keys(code)) {
      const contractPath = path.join(outputDir, c + 'SSZDecoder.sol');
      contractPaths.push(contractPath);
      await fs.writeFile(contractPath, code[c], 'utf-8');
    }
  }

  return contractPaths;
};
