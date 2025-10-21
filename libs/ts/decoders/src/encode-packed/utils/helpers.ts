import type { EvmVersion, ExpandedFieldOrArray } from '../../utils';
import { generateDecoderPrimitiveLines } from '../helpers/primitiveField';
import { generateDecoderPrimitiveLines as generateDecoderPrimitiveLinesCancun } from '../helpers/primitiveFieldCancun';
import { generateDecoderStringBytes } from '../helpers/stringBytes';
import { generateDecoderStringBytes as generateDecoderStringBytesCancun } from '../helpers/stringBytesCancun';

import type { DecoderImplementations } from './types';

export const checkForDynamicData = (
  fields: ExpandedFieldOrArray[],
): boolean => {
  return fields.some((field: ExpandedFieldOrArray) => {
    if (Array.isArray(field)) {
      return checkForDynamicData(field);
    } else if (field.isDynamic) {
      return true;
    } else if ('components' in field) {
      return checkForDynamicData(field.components!);
    }
    return false;
  });
};

export const decoderImplementationsMap: Record<
  EvmVersion,
  DecoderImplementations
> = {
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
