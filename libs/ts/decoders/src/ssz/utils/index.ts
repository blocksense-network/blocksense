import { addOffsets } from './addOffsets';
import { handleFieldRanges } from './container';
import { encodeSSZData, findUnionNames, sszSchema } from './encodeData';
import { getDecoderImplementations } from './helpers';
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
  type Schema,
  type UnionSchema,
  type SubUnionSchema,
  type BytesRange,
  type Offset,
  isVector,
  isUnion,
  hasFields,

  // helpers
  addOffsets,
  handleFieldRanges,
  getDecoderImplementations,
};
