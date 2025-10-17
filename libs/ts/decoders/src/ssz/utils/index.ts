import { addOffsets } from './addOffsets';
import { handleFieldRanges } from './container';
import { encodeSSZData, findUnionNames, sszSchema } from './encodeData';
import {
  getDecoderImplementations,
  toLowerFirstLetter,
  toUpperFirstLetter,
} from './helpers';
import {
  BytesRange,
  hasFields,
  isUnion,
  isVector,
  Offset,
  Schema,
  SubUnionSchema,
  UnionSchema,
} from './types';

export {
  // encode data
  encodeSSZData,
  sszSchema,
  findUnionNames,

  // types
  Schema,
  UnionSchema,
  SubUnionSchema,
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
