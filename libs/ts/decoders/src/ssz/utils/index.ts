import { encodeSSZData, sszSchema } from './encodeData';
import {
  Schema,
  BytesRange,
  Offset,
  isVector,
  hasFields,
  isUnion,
} from './types';
import { addOffsets } from './addOffsets';
import { handleFieldRanges } from './container';
import {
  getDecoderImplementations,
  toLowerFirstLetter,
  toUpperFirstLetter,
} from './helpers';

export {
  // encode data
  encodeSSZData,
  sszSchema,

  // types
  Schema,
  BytesRange,
  Offset,
  isVector,
  isUnion,
  hasFields,

  // helpers
  addOffsets,
  handleFieldRanges,
  getDecoderImplementations,
  toLowerFirstLetter,
  toUpperFirstLetter,
};
