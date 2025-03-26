import {
  DecoderData,
  DynamicData,
  ExpandedField,
  ExpandedFieldOrArray,
  GenerateDecoderConfig,
  Schema,
} from '../../utils';
import { generateDecoderDynamicDataLines } from './dynArrayStringBytes';
import { generateDecoderFixedBytesLines } from './fixedBytesField';
import { generateDecoderPrimitiveLines } from './primitiveField';
import { generateBigEndianConversion } from './convertToBE';
import { generateDecoderStringBytes } from './stringBytes';

export const generateDecoderLines = (schema: Schema, name: string) => {
  let shouldUpdate = false;
  const config: GenerateDecoderConfig & {
    dataRead: number;
  } = {
    wordOffset: 32,
    bitOffset: 0,
    prevSize: 0,
    dataRead: 0,
  };
  const mainStructName = name;

  const dynamicFields: DynamicData[] = [];
  let nestedDynamic: string | undefined;

  const generateDecoderLines = (
    schema: Schema | Schema[],
    name: string,
    startIndex = 0,
  ) => {
    const lines: string[] = [];
    let index = startIndex;
    let location = name;

    console.log('----> schema', schema);
    console.log('gotta reorder');
    let size = Array.isArray(schema) ? 0 : (schema.fixedSize ?? 0) * 8;
    if (!Array.isArray(schema) && schema.isDynamic && !schema.fields) {
      size = 32;
    }

    if (
      Array.isArray(schema) ||
      (!schema.fields && !schema.length) ||
      config.bitOffset >= 256
    ) {
      config.bitOffset += size;

      if (
        !Array.isArray(schema) &&
        (config.prevSize + size >= 256 || config.bitOffset >= 256)
      ) {
        config.wordOffset += config.prevSize / 8;
        config.bitOffset = size;
        shouldUpdate = true;
        config.prevSize = 0;
      }

      if (shouldUpdate && config.wordOffset > 32) {
        lines.push(`

          ${config.wordOffset > 0 ? `// Offset data with ${config.wordOffset} bytes` : ''}
          memData := mload(add(data, ${config.wordOffset}))
          `);
        shouldUpdate = false;
      }
    }

    // console.log('config', config);

    if (Array.isArray(schema)) {
      console.log('\n\n---> array');
      schema.forEach(subSchema => {
        lines.push(...generateDecoderLines(subSchema, name, index));
        index++;
      });
    } else if (schema.fields) {
      console.log('\n\n---> tuple');

      // This is the main struct
      if (
        // (name === mainStructName && !schema.length) ||
        // schema.length === 0
        !schema.fieldName ||
        schema.length === 0
      ) {
        // console.log('mainStructName', mainStructName);
        // console.log('WHYY');
        return generateDecoderLines(schema.fields, name, index);
      }

      if (schema.isDynamic) {
        // nestedDynamic = schema.fieldName + '_pos';
        lines.push(`
          // Get position of ${schema.fieldName}
          let ${schema.fieldName + '_pos'} := and(shr(${256 - config.bitOffset - 32}, memData), 0xFFFFFFFF)
        `);

        lines.push(generateBigEndianConversion(schema.fieldName + '_pos'));

        config.prevSize += 32;
        config.bitOffset += 32;

        schema.isDynamic = false;
        dynamicFields.push({
          positionName: schema.fieldName + '_pos',
          index,
          location,
          schema:
            schema.length === undefined &&
            schema.fields &&
            !schema.type.includes('tuple')
              ? schema.fields[0]
              : schema,
          isGenerated: false,
        });
      } else {
        let fields = schema.fields;

        if (schema.length) {
          fields = Array(schema.length)
            .fill(null)
            .map((_, i) => ({
              ...schema,
              length: 0,
              type: schema.type,
              fieldName: `${schema.fieldName}_${i}`,
            }));
        }

        console.log('fields', fields);

        // console.log('---fields', fields);

        const innerName = name + '_' + index;
        // console.log('are be', schema);
        lines.push(`

        {
          // Get address of field at slot ${index} of ${name}
          let ${innerName} := mload(${index ? `add(${name}, ${index * 0x20})` : name})
          ${generateDecoderLines(fields, innerName, 0).join('\n')}
          `);

        for (const [idx, field] of fields.entries()) {
          console.log('=> field', field);
          // TODO here it doesn't know how to handle the nested array cuz its not dynamic
          if (!field.fields && field.isDynamic) {
            console.log('uraaaaaaa');
            const currentField = dynamicFields.find(
              dynamicField =>
                dynamicField.positionName === field.fieldName + '_pos',
            );
            if (!currentField) {
              throw new Error(
                `Dynamic field ${field.fieldName + '_pos'} not found in dynamicFields`,
              );
            }
            const i = dynamicFields.indexOf(currentField);
            const nextField =
              i < dynamicFields.length - 1
                ? dynamicFields[i + 1].positionName
                : undefined;

            lines.push(
              generateDecoderStringBytes(dynamicFields[i], i, nextField),
            );
            dynamicFields[i].isGenerated = true;
          }

          // nestedDynamic = undefined;
        }

        lines.push('}');
      }
    } else if (schema.isDynamic) {
      // TODO maybe move above `if(schema.fields)`
      console.log('\n\n---> dynamic field');
      console.log('config', config);
      // throw new Error('Dynamic field not implemented yet');
      const fieldName = `${schema.fieldName}_${index}_pos`;
      lines.push(`

        // Get position of ${name}
        let ${fieldName} := and(shr(${256 - config.bitOffset}, memData), 0xFFFFFFFF)
      `);
      lines.push(generateBigEndianConversion(fieldName));

      if (nestedDynamic) {
        lines.push(`
          // Update nested dynamic pos
          ${fieldName} := add(${fieldName}, ${nestedDynamic})
        `);
      }

      config.prevSize += 32;
      dynamicFields.push({
        positionName: fieldName,
        index,
        location,
        schema:
          schema.length === undefined &&
          schema.fields &&
          !schema.type.includes('tuple')
            ? schema.fields[0]
            : schema,
        isGenerated: false,
      });
    } else if (!schema.isDynamic) {
      console.log('\n\n---> primitive', schema.fieldName);
      console.log('config', config);
      if (schema.length) {
        // const innerName = name + '_' + index;
        // // lines.push(
        // //   ...generateDecoderLines(
        // //     Array(schema.length).fill({
        // //       ...schema,
        // //       length: 0,
        // //       fixedSize: schema.fixedSize / schema.length,
        // //     }),
        // //     name,
        // //     0,
        // //   ),
        // // );
        // lines.push(`
        //   {
        //     // Get address of field at slot ${index} of ${name}
        //     let ${innerName} := mload(${index ? `add(${name}, ${index * 0x20})` : name})
        //     ${generateDecoderLines(Array(schema.length).fill({ ...schema, length: 0, fixedSize: schema.fixedSize / schema.length }), innerName, 0).join('\n')}
        //   }
        // `);
      } else {
        const isBytes =
          schema.type.startsWith('bytes') &&
          schema.type !== 'bytes' &&
          !schema.type.endsWith('[]');

        let shift = 0;
        const fieldSize = schema.fixedSize * 8;
        if (isBytes) {
          console.log(' --> bytes');
          // Handle bytesNum
          if (config.prevSize + fieldSize < 256) {
            shift = -config.prevSize;
            config.prevSize += fieldSize;
          } else {
            config.prevSize = fieldSize;
          }
        } else {
          console.log(' --> not bytes');
          console.log('fieldSize', fieldSize);
          // Handle non-bytes fields
          if (config.prevSize + fieldSize >= 256) {
            config.prevSize = 0;
          }

          shift = 256 - config.prevSize - fieldSize;
          config.prevSize += fieldSize;
        }

        // console.log('shift', shift);
        // console.log('config.prevSize', config.prevSize);

        lines.push(`
          // Store the next ${fieldSize} bits of memData at slot ${index} of ${location} ${schema.fieldName ? `for ${schema.fieldName}` : ''}
          mstore(${index ? `add(${location}, ${index * 0x20})` : location},
          ${
            shift === 0
              ? 'memData'
              : shift < 0
                ? `shl(${Math.abs(shift!)}, memData)`
                : fieldSize < 256
                  ? `and(shr(${shift}, memData), ${'0x' + 'F'.repeat(schema.fixedSize * 2)})`
                  : `shr(${shift}, memData)`
          })
        `);
      }
    } else {
      throw new Error('Dont know this type');
    }

    return lines;
  };

  const lines: string[] = [];

  // if (schema.isDynamic) {
  //   lines.push(`
  //     // Used to track loaded data, data starts at 32 due to length stored in the first 32 bytes
  //     let dataPointer := 32
  //   `);
  // }

  lines.push(...generateDecoderLines(schema, name));

  console.log('dynamicFields', dynamicFields);
  for (let i = 0; i < dynamicFields.length; i++) {
    if (dynamicFields[i].isGenerated) {
      continue;
    }
    const nextField =
      i < dynamicFields.length - 1
        ? dynamicFields[i + 1].positionName
        : undefined;

    const schema = dynamicFields[i].schema;
    const isBytes =
      schema.type.startsWith('bytes') &&
      schema.type !== 'bytes' &&
      schema.type !== 'bytes[]';
    const isDynamic =
      !isBytes &&
      (schema.type.startsWith('bytes') || schema.type.startsWith('string'));

    console.log('schema', schema);
    if (schema.fields) {
      nestedDynamic = dynamicFields[i].positionName;
      lines.push(`
          memData := mload(add(data, add(${nestedDynamic}, 32)))
        `);
      config.bitOffset = 0;
      config.prevSize = 0;

      lines.push(
        ...generateDecoderLines(
          schema,
          dynamicFields[i].location,
          dynamicFields[i].index,
        ),
      );
      nestedDynamic = undefined;
    } else if (isDynamic) {
      lines.push(generateDecoderStringBytes(dynamicFields[i], i, nextField));
    } else {
      console.log('helo?');
      lines.push(
        generateDecoderPrimitiveLines(dynamicFields[i], i, isBytes, nextField),
      );
    }

    dynamicFields[i].isGenerated = true;
  }

  return lines;
};
