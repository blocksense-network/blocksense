import type { EvmVersion } from '../../utils';
import { generateDecoderPrimitiveLines } from '../helpers/primitiveField';
import { generateDecoderPrimitiveLines as generateDecoderPrimitiveLinesCancun } from '../helpers/primitiveFieldCancun';
import { generateDecoderStringBytes } from '../helpers/stringBytes';
import { generateDecoderStringBytes as generateDecoderStringBytesCancun } from '../helpers/stringBytesCancun';

import type { DecoderImplementations } from './types';

const decoderImplementationsMap: Record<EvmVersion, DecoderImplementations> = {
  cancun: {
    generateDecoderPrimitiveLines: generateDecoderPrimitiveLinesCancun,
    generateDecoderStringBytes: generateDecoderStringBytesCancun,
  },
  legacy: {
    generateDecoderPrimitiveLines,
    generateDecoderStringBytes,
  },
};

/**
 * Returns the decoder implementations for the given key.
 * If the key is not "cancun", returns the default implementation.
 */
export function getDecoderImplementations(
  evmVersion: EvmVersion = 'cancun',
): DecoderImplementations {
  return (
    decoderImplementationsMap[evmVersion] || decoderImplementationsMap.legacy
  );
}

export const toLowerFirstLetter = (name: string): string => {
  if (!name) return '';
  return name.charAt(0).toLowerCase() + name.slice(1);
};

export const toUpperFirstLetter = (name: string) => {
  if (!name) return '';
  return name.charAt(0).toUpperCase() + name.slice(1);
};
