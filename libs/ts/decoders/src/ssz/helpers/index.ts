import type { EvmVersion } from '../../utils';
import type { Offset, Schema } from '../utils/';
import { getDecoderImplementations, hasFields, isVector } from '../utils/';
import { addOffsets } from '../utils/addOffsets';
import { handleFieldRanges } from '../utils/container';

import { generateNestedDynamic } from './nestedDynamic';

export const generateDecoderLines = (
  schema: Schema,
  name: string,
  evmVersion: EvmVersion = 'cancun',
  start: number = 0,
): string[] => {
  const { generateDecoderPrimitiveLines, generateDecoderStringBytes } =
    getDecoderImplementations(evmVersion);

  let dynamicIndex = 0;
  const generateDecoderLines = (
    schema: Schema,
    location: string,
    index = 0,
    start: Offset = 0,
    end: Offset = 0,
    prevSszFixedSize: number | null,
    counter?: string,
  ): string[] => {
    const lines: string[] = [];

    const fieldName = schema.fieldName ? schema.fieldName : name;

    if (hasFields(schema)) {
      if (schema.typeName.startsWith('Container')) {
        // tuple here
        const ranges = handleFieldRanges(
          schema,
          lines,
          location,
          start,
          end,
          fieldName,
        );

        let innerName = `${fieldName}_${location}_${index}`;
        lines.push('{');
        if (schema.isNested) {
          const isFirst = schema.fieldName ? true : !prevSszFixedSize;
          lines.push(`
              // Create new tuple space
              let ${innerName} := mload(0x40)
              mstore(0x40, add(${innerName}, ${schema.fields.length * 32}))

              // Store new tuple
              ${
                counter && isFirst
                  ? `mstore(add(${location}, mul(
                      ${
                        schema.prevType?.type === 'Vector'
                          ? index
                            ? `add(${counter}, ${index})`
                            : counter
                          : `add(${counter}, 1)`
                      }, 0x20)
                    ), ${innerName})`
                  : `mstore(${index ? `add(${location}, ${index * 32})` : location}, ${innerName})`
              }
            `);
        } else if (!schema.isFirst) {
          lines.push(`
            // Get address of field at slot ${index} of ${location}
            let ${innerName} := mload(${index ? `add(${location}, ${index * 0x20})` : location})
          `);
        } else {
          // main container which is not a Vector or List
          innerName = location;
        }
        schema.fields.forEach((subSchema, i) => {
          let newStart = ranges[i].start.value;
          if (!ranges[i].start.isGenerated) {
            ranges[i].start.isGenerated = true;
            if (
              !(
                typeof start === 'string' &&
                typeof ranges[i].start.value === 'number'
              )
            ) {
              newStart = addOffsets(lines, ranges[i].start.value, start);
            } else {
              newStart = addOffsets(undefined, ranges[i].start.value, start);
            }
          }
          let newEnd = ranges[i].end.value;
          if (!ranges[i].end.isGenerated) {
            ranges[i].end.isGenerated = true;
            if (
              !(
                typeof start === 'string' &&
                typeof ranges[i].end.value === 'number'
              )
            ) {
              newEnd = addOffsets(lines, ranges[i].end.value, start);
            } else {
              newEnd = addOffsets(undefined, ranges[i].end.value, start);
            }
          }

          lines.push(
            ...generateDecoderLines(
              subSchema,
              innerName,
              i,
              newStart,
              newEnd,
              schema.sszFixedSize,
            ),
          );
        });
        lines.push('}\n');
      } else if (schema.typeName.startsWith('List')) {
        if (
          schema.types[1] &&
          !['Vector', 'List', 'ByteList'].includes(schema.types[1].type)
        ) {
          // list basic
          const isBytesNum =
            schema.type.startsWith('bytes') &&
            schema.type !== 'bytes' &&
            !schema.type.startsWith('bytes[');

          lines.push(
            generateDecoderPrimitiveLines(
              schema,
              location,
              index,
              isBytesNum,
              start,
              end,
              counter,
            ),
          );
        } else {
          lines.push(`
            // List Composite for ${fieldName}
            {
              ${arrayComposite(schema, location, index, start, end, counter)}
            }
            `);
        }

        dynamicIndex++;
      } else if (isVector(schema)) {
        // vector here
        if (schema.sszFixedSize) {
          // basic
          let innerName = `${location}_${index}`;
          const elSize = schema.sszFixedSize / schema.length;

          lines.push(`
            // Vector Basic for ${fieldName}
            {
          `);
          if (schema.isNested) {
            lines.push(`
              // Create new vector space
              let ${innerName} := mload(0x40)
              mstore(0x40, add(${innerName}, ${schema.length * 32}))

              // Store new vector
              ${
                counter
                  ? `mstore(add(${location}, mul(${schema.prevType?.type === 'Vector' ? counter : `add(${counter}, 1)`}, 0x20)), ${innerName})`
                  : `mstore(${index ? `add(${location}, ${index * 32})` : location}, ${innerName})`
              }
            `);
          } else if (!schema.isFirst) {
            lines.push(`
              // Get address of field at slot ${index} of ${location}
              let ${innerName} := mload(${index ? `add(${location}, ${index * 0x20})` : location})
            `);
          } else {
            innerName = location;
          }
          for (let i = 0; i < schema.length!; i++) {
            lines.push(
              ...generateDecoderLines(
                schema.fields[0],
                innerName,
                i,
                addOffsets(
                  schema.isNested ? undefined : lines,
                  start,
                  i * elSize,
                ),
                addOffsets(
                  schema.isNested ? undefined : lines,
                  start,
                  (i + 1) * elSize,
                ),
                schema.sszFixedSize,
                counter,
              ),
            );
          }

          lines.push('}\n');
        } else {
          // composite
          lines.push(`
            // Vector Composite for ${fieldName}
            {
              ${arrayComposite(schema, location, index, start, end, counter)}
            }
            `);
        }
      }
    } else if (schema.sszFixedSize) {
      // primitive here
      if (
        schema.typeName.startsWith('ByteVector') &&
        schema.type.includes('byte')
      ) {
        // bytesNum
        // shift to left
        lines.push(`
        // Store ${schema.sszFixedSize * 8} bits of data at slot ${index} of ${location} ${schema.fieldName ? `for ${schema.fieldName}` : ''}
        mstore(${index ? `add(${location}, ${index * 0x20})` : location},
        mload(add(data, ${start})))
        `);
      } else {
        // shift to right
        lines.push(`
              // Store ${schema.sszFixedSize * 8} bits of data at slot ${index} of ${location} ${schema.fieldName ? `for ${schema.fieldName}` : ''}
              mstore(${index ? `add(${location}, ${index * 0x20})` : location},
                ${
                  schema.sszFixedSize < 32
                    ? `shr(${256 - schema.sszFixedSize * 8}, mload(add(data, ${start})))`
                    : `mload(add(data, ${start}))`
                }
              )
            `);
      }
    } else {
      // string/bytes
      lines.push(
        generateDecoderStringBytes(
          schema,
          location,
          index,
          start,
          end,
          counter,
        ),
      );
    }

    return lines;
  };

  const arrayComposite = (
    schema: Schema & { fields: Schema[] },
    location: string,
    index: number,
    start: Offset,
    end: Offset,
    counter?: string,
  ) => {
    const currentSchema = schema;
    const innerSchema = schema.fields[0];

    return generateNestedDynamic(
      currentSchema,
      innerSchema,
      location,
      index,
      (newStart, newEnd, newLocation, newIndex) => {
        return generateDecoderLines(
          innerSchema,
          newLocation,
          newIndex,
          newStart,
          newEnd,
          schema.sszFixedSize,
          `${newLocation}_i`,
        ).join('\n');
      },
      start,
      end,
      counter,
    );
  };

  const lines: string[] = [];
  let length = 'mload(data)'; // default length location
  if (start) {
    lines.push(
      `let data_length := shr(${256 - start * 8}, mload(add(data, 32)))`,
    );
    length = 'data_length';
  }

  return lines.concat(
    generateDecoderLines(
      schema,
      name,
      0,
      32 + start, // data starts 32 bytes after beginning (this is where length is stored)
      `add(${length}, 32)`, // load length of data
      null,
    ),
  );
};
