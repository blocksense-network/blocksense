/* eslint-disable @typescript-eslint/no-require-imports */
import type {
  DecoderImplementations,
  DecoderPrimitiveLines,
  DecoderStringBytes,
} from './types';

const decoderImplementationsMap: Record<string, DecoderImplementations> = {
  cancun: {
    generateDecoderPrimitiveLines: require('../helpers/primitiveFieldCancun')
      .generateDecoderPrimitiveLines as DecoderPrimitiveLines,
    generateDecoderStringBytes: require('../helpers/stringBytesCancun')
      .generateDecoderStringBytes as DecoderStringBytes,
  },
  default: {
    generateDecoderPrimitiveLines: require('../helpers/primitiveField')
      .generateDecoderPrimitiveLines as DecoderPrimitiveLines,
    generateDecoderStringBytes: require('../helpers/stringBytes')
      .generateDecoderStringBytes as DecoderStringBytes,
  },
};

/**
 * Returns the decoder implementations for the given key.
 * If the key is not "cancun", returns the default implementation.
 */
export function getDecoderImplementations(key: string): DecoderImplementations {
  return decoderImplementationsMap[key] ?? decoderImplementationsMap.default;
}

export const toLowerFirstLetter = (name: string): string => {
  if (!name) return '';
  return name.charAt(0).toLowerCase() + name.slice(1);
};

export const toUpperFirstLetter = (name: string) => {
  if (!name) return '';
  return name.charAt(0).toUpperCase() + name.slice(1);
};
