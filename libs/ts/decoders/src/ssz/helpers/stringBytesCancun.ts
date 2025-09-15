import type { Offset, Schema } from '../utils';

export const generateDecoderStringBytes = (
  schema: Schema,
  location: string,
  index: number,
  start: Offset,
  end: Offset,
  isMainSchemaContainer: boolean,
  counter?: string,
) => {
  const fieldName =
    (isMainSchemaContainer || schema.isNested ? '_' : '') + schema.fieldName;

  return `
    // String/Bytes for ${schema.fieldName}
    {
      let ${fieldName}_size := sub(${end}, ${start})
      ${isMainSchemaContainer || schema.isNested ? 'let' : ''} ${fieldName} := mload(0x40)
      ${
        counter
          ? `mstore(add(${location}, mul(${schema.prevType?.type === 'Vector' ? counter : `add(${counter}, 1)`}, 0x20)), ${fieldName})`
          : `mstore(${index ? `add(${location}, ${index * 0x20})` : location}, ${fieldName})`
      }

      // take a mod of 32 to update the free memory pointer
      mstore(0x40, add(${fieldName}, and(add(${fieldName}_size, 64), 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFe0)))
      mstore(${fieldName}, ${fieldName}_size)

      mcopy(
        add(${fieldName}, 32),
        add(data, ${start}),
        ${fieldName}_size
      )
    }
  `;
};
