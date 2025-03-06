import {
  DecoderData,
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

  const generateDecoderLines = (
    schema: Schema | Schema[],
    name: string,
    startIndex = 0,
  ) => {
    const lines: string[] = [];
    let index = startIndex;
    let location = name;

    // console.log('----> schema', schema);
    if (Array.isArray(schema) || (!schema.fields && !schema.length)) {
      config.bitOffset +=
        Array.isArray(schema) || schema.isDynamic ? 0 : schema.fixedSize * 8;

      if (
        !Array.isArray(schema) &&
        (config.prevSize + (schema.fixedSize ?? 0) * 8 >= 256 ||
          config.bitOffset >= 256)
      ) {
        config.wordOffset += config.prevSize / 8;
        config.bitOffset = schema.isDynamic ? 0 : (schema.fixedSize ?? 0) * 8;
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
      // } else if (
      //   schema.length &&
      //   (schema.type.match(/\[\d+\]/g) ?? []).length > 1
      // ) {
      //   console.log('---> nested fixed array');

      //   console.log('\n ----> schema type', schema.type);
      //   // remove only last occurrence of '[<number>]'
      //   const schemaType = schema.type.replace(/\[\d+\](?!.*\[\d+\])/, '');
      //   console.log('\n ----> schema type', schema.type);
      //   const matches = [...schemaType.matchAll(/\[(\d+)\]/g)].map(match =>
      //     Number(match[1]),
      //   );
      //   const prevSize = matches.pop() ?? 0;

      //   const fields = Array(schema.length).fill({
      //     ...schema,
      //     type: schemaType,
      //     fixedSize: schema.fixedSize / schema.length,
      //     length: prevSize,
      //   });

      //   const innerName = name + '_' + index;
      //   lines.push(`

      //     {
      //       // Get address of field at slot ${index} of ${name}
      //       let ${innerName} := mload(${index ? `add(${name}, ${index * 0x20})` : name})
      //       ${generateDecoderLines(fields, innerName, 0).join('\n')}
      //     }
      //   `);
    } else if (schema.isDynamic) {
      throw new Error('Dynamic field not implemented yet');
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

      let fields = schema.fields;

      if (schema.length) {
        fields = Array(schema.length).fill({
          ...schema,
          length: 0,
          type: schema.type,
        });
      }

      // console.log('---fields', fields);

      const innerName = name + '_' + index;
      // console.log('are be', schema);
      lines.push(`

        {
          // Get address of field at slot ${index} of ${name}
          let ${innerName} := mload(${index ? `add(${name}, ${index * 0x20})` : name})
          ${generateDecoderLines(fields, innerName, 0).join('\n')}
        }
      `);
    } else if (!schema.isDynamic) {
      console.log('\n\n---> primitive');
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
          // Handle non-bytes fields
          if (config.prevSize + fieldSize >= 256) {
            config.prevSize = 0;
          }

          shift = 256 - config.prevSize - fieldSize;
          config.prevSize += fieldSize;
        }

        // console.log('shift', shift);
        // console.log('config.prevSize', config.prevSize);

        console.log('\n---> primitive ', schema.fieldName);

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

  if (schema.isDynamic) {
    lines.push(`
      // Used to track loaded data, data starts at 32 due to length stored in the first 32 bytes
      let dataPointer := 32
    `);
  }

  return generateDecoderLines(schema, name);
};
