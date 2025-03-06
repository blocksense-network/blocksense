import {
  TupleField,
  PrimitiveField,
  ComponentField,
  ExpandedField,
  ExpandedFieldOrArray,
  GenerateDecoderConfig,
  DecoderData,
  Struct,
  Schema,
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
  Schema,

  // parse structs for Solidity generation
  organizeFieldsIntoStructs,

  // helpers
  checkPrimitiveField,
};
