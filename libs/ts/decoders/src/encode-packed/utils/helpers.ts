/* eslint-disable @typescript-eslint/no-require-imports */
import type { ExpandedFieldOrArray } from '../../utils';

import type { DecoderImplementations, DecoderLines } from './types';

export const checkForDynamicData = (fields: ExpandedFieldOrArray[]) => {
  let containsDynamicData = false;

  fields.forEach(field => {
    if (Array.isArray(field)) {
      containsDynamicData = containsDynamicData || checkForDynamicData(field);
    } else if (field.isDynamic) {
      containsDynamicData = true;
      return;
    } else if ('components' in field) {
      containsDynamicData =
        containsDynamicData || checkForDynamicData(field.components!);
    }
  });

  return containsDynamicData;
};

export const decoderImplementationsMap: Record<string, DecoderImplementations> =
  {
    cancun: {
      generateDecoderPrimitiveLines: require('../helpers/primitiveFieldCancun')
        .generateDecoderPrimitiveLines as DecoderLines,
      generateDecoderStringBytes: require('../helpers/stringBytesCancun')
        .generateDecoderStringBytes as DecoderLines,
    },
    default: {
      generateDecoderPrimitiveLines: require('../helpers/primitiveField')
        .generateDecoderPrimitiveLines as DecoderLines,
      generateDecoderStringBytes: require('../helpers/stringBytes')
        .generateDecoderStringBytes as DecoderLines,
    },
  };

/**
 * Returns the decoder implementations for the given key.
 * If the key is not "cancun", returns the default implementation.
 */
export function getDecoderImplementations(key: string): DecoderImplementations {
  return decoderImplementationsMap[key] ?? decoderImplementationsMap.default;
}
