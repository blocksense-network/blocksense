export type Schema = {
  isNested: boolean;
  type: string;
  typeName: string;
  fixedSize: number;
  sszFixedSize: number | null;
  isFirst?: boolean;
  length?: number;
  fieldName?: string;
  fields?: Schema[];
  isFixedLen?: boolean[];
  fieldRangesFixedLen?: { start: Offset; end: Offset }[];
  variableOffsetsPosition?: number[];
  prevType?: { type: string; length?: number };
  types: { type: string; length?: number }[];
};

export type Offset = number | string;

export type BytesRange = {
  start: {
    value: Offset;
    isGenerated: boolean;
  };
  end: { value: Offset; isGenerated: boolean };
};

/**
 * Checks if the schema has fields
 */
export const hasFields = (
  schema: Schema,
): schema is Schema & { fields: Schema[] } => {
  return (schema as Schema & { fields: Schema[] }).fields !== undefined;
};

/**
 * Checks if the schema is a vector and has a length
 */
export const isVector = (
  schema: Schema,
): schema is Schema & { length: number } => {
  return schema.typeName.startsWith('Vector') && schema.length !== undefined;
};

export type DecoderPrimitiveLines = (
  schema: Schema,
  location: string,
  index: number,
  isBytes: boolean,
  start: Offset,
  end: Offset,
  counter?: string,
) => string;

export type DecoderStringBytes = (
  schema: Schema,
  location: string,
  index: number,
  start: Offset,
  end: Offset,
  counter?: string,
) => string;

export type DecoderImplementations = {
  generateDecoderPrimitiveLines: DecoderPrimitiveLines;
  generateDecoderStringBytes: DecoderStringBytes;
};
