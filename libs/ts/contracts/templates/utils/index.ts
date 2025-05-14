import {
  TupleField,
  PrimitiveField,
  ComponentField,
  ExpandedField,
  ExpandedFieldOrArray,
  GenerateDecoderConfig,
  DecoderData,
  Struct,
} from './types';
import { organizeFieldsIntoStructs } from './parseStructs';
import { checkPrimitiveField } from './helpers';

export {
  // types
  TupleField,
  PrimitiveField,
  ComponentField,
  ExpandedField,
  ExpandedFieldOrArray,
  GenerateDecoderConfig,
  DecoderData,
  Struct,

  // parse structs for Solidity generation
  organizeFieldsIntoStructs,

  // helpers
  checkPrimitiveField,
};
