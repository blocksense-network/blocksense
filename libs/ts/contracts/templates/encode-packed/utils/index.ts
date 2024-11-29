import {
  TupleField,
  PrimitiveField,
  ComponentField,
  ExpandedField,
  ExpandedFieldOrArray,
  GenerateDecoderConfig,
  DecoderData,
} from './types';
import { organizeFieldsIntoStructs } from './parseStructs';
import { processFieldsAndEncodeData } from './encodeData';
import { expandFields } from './expandFields';
import { calculateFieldShift } from './adjustFields';
import * as helpers from './helpers';

// TODO: move non-specific to encoding utils out of this directory when adding SSZ
export {
  // types
  TupleField,
  PrimitiveField,
  ComponentField,
  ExpandedField,
  ExpandedFieldOrArray,
  GenerateDecoderConfig,
  DecoderData,

  // helpers
  helpers,

  // parse data
  organizeFieldsIntoStructs,

  // encode data
  processFieldsAndEncodeData,

  // expand fields
  expandFields,

  // calculate field shift
  calculateFieldShift,
};
