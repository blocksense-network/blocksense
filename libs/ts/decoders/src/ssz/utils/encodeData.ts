import { ethers } from 'ethers';
import { checkPrimitiveField, PrimitiveField, TupleField } from '../../utils';
import { ContainerType } from '@chainsafe/ssz';
import { Schema } from './types';

const BYTES_LIMIT = 8192;
const ARRAY_LIMIT = 1024;

export type UintBigintByteLen = 1 | 2 | 4 | 8 | 16 | 32;

function isValidUintBigintByteLen(value: number): value is UintBigintByteLen {
  return [1, 2, 4, 8, 16, 32].includes(value);
}

function convertNumberEndianness(
  value: number | bigint,
  arrayLength: number,
  returnNumber: boolean = true,
) {
  let bigIntValue: bigint;

  if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      throw new Error('Number value must be an integer.');
    }
    bigIntValue = BigInt(value);
  } else {
    bigIntValue = value;
  }

  if (bigIntValue < 0n) {
    bigIntValue = (1n << BigInt(arrayLength * 8)) + bigIntValue;
  }

  const uint8Array = new Uint8Array(arrayLength);

  // Convert number to little-endian Uint8Array
  for (let i = 0; i < arrayLength; i++) {
    uint8Array[i] = Number(bigIntValue & 0xffn);
    bigIntValue >>= 8n;
  }

  if (!returnNumber) {
    return uint8Array.reverse();
  } else {
    // Convert the big-endian Uint8Array back to a number/bigint
    let result = 0n;
    for (const byte of uint8Array) {
      result = (result << 8n) | BigInt(byte);
    }

    return result;
  }
}

export const createSchema = async (
  fields: PrimitiveField | TupleField,
): Promise<ContainerType<any>> => {
  const ssz = await import('@chainsafe/ssz');

  function isPowerOfTwo(num: number) {
    return (num & (num - 1)) === 0;
  }

  function isTypeBasic(type: string) {
    return type.includes('int') || type.includes('bool');
  }

  /**
   * Recursively constructs an SSZ type from a TupleField definition, handling arrays.
   */
  function createSSZType(field: TupleField | PrimitiveField): any {
    // Handle array types
    const arrayMatch = getTypeAndDimensions(field.type);
    let fieldSize = 0;
    if (checkPrimitiveField(field) && field.size) {
      fieldSize = field.size / 8;
    }
    if (arrayMatch) {
      const baseType = arrayMatch.type;
      const dimensions = arrayMatch.dimensions;
      const length = dimensions.length;
      const elementType = createSSZType({
        ...field,
        type:
          baseType +
          dimensions
            .slice(0, -1)
            .map(d => `[${d}]`)
            .join(''),
      });
      const lastDimension = +dimensions[length - 1];

      if (length > 1) {
        return lastDimension === 0
          ? new ssz.ListCompositeType(elementType, ARRAY_LIMIT)
          : new ssz.VectorCompositeType(elementType, lastDimension);
      }
      if (lastDimension === 0) {
        // lists
        if (isTypeBasic(baseType) && isPowerOfTwo(fieldSize)) {
          return new ssz.ListBasicType(elementType, ARRAY_LIMIT);
        }
        return new ssz.ListCompositeType(elementType, ARRAY_LIMIT);
      }
      // vectors
      return isTypeBasic(baseType) && isPowerOfTwo(fieldSize)
        ? new ssz.VectorBasicType(elementType, lastDimension)
        : new ssz.VectorCompositeType(elementType, lastDimension);
    }

    if (field.type.startsWith('tuple')) {
      const components: Record<string, any> = {};
      (field as TupleField).components.forEach(comp => {
        components[comp.name] = createSSZType(comp);
      });
      return new ssz.ContainerType(components);
    }

    // Handle primitive types
    switch (field.type) {
      case 'address':
        return new ssz.ByteVectorType(20);
      case 'bool':
        return new ssz.BooleanType();
      case 'string':
      case 'bytes':
        return new ssz.ByteListType(BYTES_LIMIT); // Approximation of a string
      default:
        if (field.type.includes('int') && isValidUintBigintByteLen(fieldSize)) {
          return new ssz.UintBigintType(fieldSize);
        }
        return new ssz.ByteVectorType(fieldSize);
    }
  }

  function getTypeAndDimensions(typeString: string) {
    const regex = /(\w+)(?:\[(\d*)\])+/;
    const match = typeString.match(regex);

    if (!match) {
      return null; // Or throw an error, depending on your needs
    }

    const type = match[1];
    const dimensions: string[] = [];

    // Use matchAll to get all dimension matches
    const dimensionMatches = typeString.matchAll(/\[(\d*)\]/g); // The 'g' flag is important!
    for (const dimMatch of dimensionMatches) {
      dimensions.push(dimMatch[1]);
    }

    return { type, dimensions };
  }

  return createSSZType(fields) as ContainerType<any>;
};

export const encodeSSZData = async (
  fields: PrimitiveField | TupleField,
  values: any[],
): Promise<string> => {
  const ssz = await import('@chainsafe/ssz');

  /**
   * Populates input data into a format compatible with SSZ serialization.
   */
  function populateInputData(schema: any, values: any): any {
    if (schema instanceof ssz.ContainerType) {
      const data: Record<string, any> = {};
      let index = 0;
      for (const key of Object.keys(schema.fields)) {
        data[key] = populateInputData(schema.fields[key], values[index]);
        index++;
      }
      return data;
    } else if (
      schema instanceof ssz.ListCompositeType ||
      schema instanceof ssz.ListBasicType ||
      schema instanceof ssz.VectorBasicType ||
      schema instanceof ssz.VectorCompositeType
    ) {
      return values.map((val: any) =>
        populateInputData(schema.elementType, val),
      );
    } else if (schema instanceof ssz.UintBigintType) {
      return convertNumberEndianness(values, schema.byteLength);
    } else if (schema instanceof ssz.ByteVectorType) {
      return ethers.isHexString(values)
        ? ethers.toBeArray(values)
        : // for uint/int when not power ot 2, e.g. uint48
          convertNumberEndianness(values, schema.lengthBytes, false);
    } else if (schema instanceof ssz.ByteListType) {
      if (ethers.isHexString(values)) {
        return ethers.toBeArray(values);
      }
      return ethers.toUtf8Bytes(values);
    }
    return values;
  }

  const schema = await createSchema(fields);
  const populatedData = populateInputData(schema, values);
  return ethers.hexlify(schema.serialize(populatedData));
};

export const sszSchema = async (
  fields: PrimitiveField | TupleField,
): Promise<Schema[]> => {
  const ssz = await import('@chainsafe/ssz');

  const extractFieldsFromSchema = (
    fields: Record<string, any> | any[],
    inputFields: PrimitiveField | TupleField,
    extraData?: {
      fieldName: string;
      type: string;
      isNested: boolean;
      prevType: {
        type: string;
        length?: number;
      };
    },
  ) => {
    const result: any[] = [];

    for (const field of Object.values(fields)) {
      const types = parseTypeName(field.typeName);

      const data: Schema = {
        isNested: extraData?.isNested ?? false,
        typeName: field.typeName,
        fixedSize: field.fixedSize,
        sszFixedSize: field.fixedSize,
        type: extraData?.type ?? field.type ?? '',
        fieldName: toLowerFirstLetter(extraData?.fieldName ?? field.fieldName),
        length: field.length,
        prevType: extraData?.prevType,
        types,
      };

      if (field.fields) {
        Object.values(field.fields as Schema[]).forEach(
          (f: Schema, i: number) => {
            f.fieldName = toLowerFirstLetter(
              Object.keys(field.jsonKeyToFieldName)[i] ?? field.fieldName,
            );
            f.type =
              findFieldTypeByName(inputFields, f.fieldName) ?? field.type;
          },
        );
        data.fields = extractFieldsFromSchema(field.fields, inputFields);
        data.isFixedLen = field.isFixedLen;
        data.fieldRangesFixedLen = field.fieldRangesFixedLen;
        data.variableOffsetsPosition = field.variableOffsetsPosition;
      } else if (
        field.elementType instanceof ssz.VectorCompositeType ||
        field.elementType instanceof ssz.VectorBasicType ||
        field instanceof ssz.VectorBasicType ||
        field instanceof ssz.VectorCompositeType ||
        field instanceof ssz.ListCompositeType ||
        field instanceof ssz.ListBasicType
      ) {
        let type = field.type ?? data.type;
        const listsLength = (field.typeName.match(/List/g) ?? []).length;
        const vectorsLength = (field.typeName.match(/Vector/g) ?? []).length;
        const dynamicCount = listsLength + vectorsLength;
        const dimensions = type.match(/\[\d*\]/g) || [];
        const lastDimension = dimensions[dimensions.length - 1];
        const isFixed = field.typeName.startsWith('Vector');

        if (
          lastDimension &&
          ((!isFixed && lastDimension === '[]') ||
            (isFixed && lastDimension.match(/^\[(\d+)\]$/)![1]))
        ) {
          type = type.replace(/\[\d*\]$/g, '');
        }

        // data is a primitive type with single dynamic dimension
        const isPrimitiveDynamic = !!(
          listsLength === 1 &&
          field.typeName.includes('ByteVector') &&
          !field.typeName.includes('Container')
        );
        const isContainerDynamic = !!(
          listsLength && field.typeName.includes('Container')
        );
        const isNestedDynamic = !!(
          dynamicCount > 1 &&
          listsLength &&
          field.typeName.startsWith('List')
        );

        data.isNested ||=
          !isPrimitiveDynamic && (isNestedDynamic || isContainerDynamic);

        data.fields = extractFieldsFromSchema(
          {
            data: field.elementType,
          },
          inputFields,
          {
            fieldName: toLowerFirstLetter(field.fieldName ?? data.fieldName),
            type,
            isNested: data.isNested,
            prevType: data.types[0],
          },
        );

        if (!data.fixedSize) {
          let size = 0;
          data.fields.forEach((f: Schema) => {
            size += f.fixedSize;
          });
          data.fixedSize = size;
        }
      } else if (field.elementType instanceof ssz.ContainerType) {
        const tuple = field.elementType;
        data.isFixedLen = tuple.isFixedLen;
        data.fieldRangesFixedLen = tuple.fieldRangesFixedLen;
        data.variableOffsetsPosition = tuple.variableOffsetsPosition;
        data.fields = extractFieldsFromSchema(tuple.fields, inputFields);
        if (!data.fixedSize) {
          let size = 0;
          data.fields.forEach((f: Schema, i: number) => {
            f.fieldName = toLowerFirstLetter(
              Object.keys(tuple.jsonKeyToFieldName)[i],
            );
            f.type = findFieldTypeByName(inputFields, f.fieldName);
            size += f.fixedSize;
          });
          data.fixedSize = size;
        } else {
          data.fields.forEach((f: Schema, i: number) => {
            f.fieldName = toLowerFirstLetter(
              Object.keys(tuple.jsonKeyToFieldName)[i],
            );
            f.type = findFieldTypeByName(inputFields, f.fieldName);
          });
        }
      } else {
        let type = field.type ?? data.type;
        const dynamicCount =
          (field.typeName.match(/\wList/g) ?? []).length +
          (field.typeName.match(/Vector/g) ?? []).length;
        // `type` must have dynamicCount-1 times `[]`
        const matches = type.match(/\[\d*\]/g) || [];
        if (matches.length === dynamicCount) {
          type = type.replace(/\[\d*\]$/g, '');
        }

        data.type = type;
      }
      result.push(data);
    }

    return result;
  };

  const schema = extractFieldsFromSchema(
    {
      data: await createSchema(fields),
    },
    fields,
  );

  // needed when decoded data is a dynamic array of the main tuple
  schema[0].isFirst = true;

  return schema;
};

const findFieldTypeByName = (
  fields: PrimitiveField | TupleField,
  name: string,
): string => {
  if ('components' in fields) {
    if (fields.name === name) {
      return fields.type;
    }
    for (const component of fields.components) {
      const found = findFieldTypeByName(component, name);
      if (found) {
        return found;
      }
    }
  } else if (Array.isArray(fields)) {
    for (const field of fields) {
      const found = findFieldTypeByName(field, name);
      if (found) {
        return found;
      }
    }
  } else if (fields.name === name) {
    return fields.type;
  }

  return '';
};

const parseTypeName = (typeName: string) => {
  if (!typeName) return [];

  const result: Schema['types'] = [];

  const parse = (str: string): void => {
    const match = /^(\w+)(?:\[(.*)\])?$/.exec(str.trim());
    if (!match) return;

    const [, type, params] = match;
    const entry: Schema['types'][0] = { type, length: undefined };
    result.push(entry);

    if (!params) return;

    let depth = 0,
      part = '',
      args: string[] = [];
    for (let i = 0; i < params.length; i++) {
      const char = params[i];
      if (char === '[') depth++;
      else if (char === ']') depth--;

      if (char === ',' && depth === 0) {
        args.push(part.trim());
        part = '';
      } else {
        part += char;
      }
    }
    if (part) args.push(part.trim());

    for (const arg of args) {
      if (!/^\d+$/.test(arg)) {
        parse(arg);
      } else if (type !== 'List') {
        entry.length = +arg;
      }
    }
  };

  parse(typeName);
  return result;
};

const toLowerFirstLetter = (fieldName: string): string => {
  if (!fieldName) return '';
  return fieldName.charAt(0).toLowerCase() + fieldName.slice(1);
};
