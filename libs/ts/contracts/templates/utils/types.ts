export type PrimitiveField = {
  name: string;
  type: string;
  size?: number;
};

export type TupleField = {
  name: string;
  type: string;
  components: ComponentField;
};

export type ComponentField = (PrimitiveField | TupleField)[];

export type ExpandedField = {
  name: string;
  type: string;
  size: number;
  shift?: number;
  iterations?: number;
  isDynamic?: boolean;
  components?: Exclude<ExpandedFieldOrArray, ExpandedField>;
};

export type ExpandedFieldOrArray = ExpandedField | ExpandedFieldOrArray[];

export type GenerateDecoderConfig = {
  wordOffset: number;
  prevSize: number;
  bitOffset: number;
};

export type DecoderData = {
  config: GenerateDecoderConfig;
  field: ExpandedField;
  location: string;
  index: number;
};

export type Struct = {
  name: string;
  fields: PrimitiveField[];
};

export type Schema = {
  isBasic: boolean;
  isDynamic: boolean;
  type: string;
  typeName: string;
  fixedSize: number;
  fixedEnd: boolean;
  length?: number;
  fieldName?: string;
  fields?: Schema[];
  isFixedLen?: boolean[];
  fieldRangesFixedLen?: { start: number; end: number }[];
  variableOffsetsPosition?: number[];
};

export type DynamicData = {
  positionName: string;
  index: number;
  location: string;
  schema?: Schema;
  isGenerated: boolean;
};
