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
import { generateNestedDynamic } from './nestedDynamic';

export const generateDecoderLines = (schema: Schema, name: string) => {
  const config: GenerateDecoderConfig & {
    dataRead: number;
  } = {
    wordOffset: 32,
    bitOffset: 0,
    prevSize: 0,
    dataRead: 0,
  };
  const mainStructName = name;
  let nested: string | undefined;
  let dynamicCounter: string | undefined;
  let nestedLength: number | undefined;
  let nextOffset: string | undefined;
  let prevOffset: string | undefined;

  const generateDecoderLines = (
    schema: Schema | Schema[],
    name: string,
    index = 0,
    level = 0,
    nestedDynamic?: string,
    prevLocation?: string,
  ): { lines: string[]; dynamicFields: DynamicData[] } => {
    const lines: string[] = [];
    const dynamicFields: DynamicData[] = [];

    const location = name;
    let size = 0;
    if (!Array.isArray(schema) && !schema.fields) {
      size = schema.isDynamic ? 32 : (schema.fixedSize ?? 0) * 8;
    }
    if (
      (size || config.bitOffset >= 256) &&
      ((Array.isArray(schema) && schema.length > 1) ||
        (!Array.isArray(schema) &&
          (schema.isDynamic || (!schema.fields && !schema.length))))
    ) {
      config.bitOffset += size;

      if (
        !Array.isArray(schema) &&
        (config.prevSize + size >= 256 || config.bitOffset >= 256)
      ) {
        config.wordOffset += config.prevSize / 8;
        config.bitOffset = size;
        config.prevSize = 0;

        if (config.wordOffset > 32 || nestedDynamic || nested) {
          const adjustedOffset = config.wordOffset
            ? `add(${nestedDynamic}, ${config.wordOffset})`
            : nestedDynamic;
          const nestedOffset = config.wordOffset
            ? `add(${nested}, ${config.wordOffset})`
            : nested;
          lines.push(`

            ${config.wordOffset > 0 ? `// Offset data with ${config.wordOffset} bytes for ${schema.fieldName}` : ''}
            memData := mload(add(data, ${
              nested
                ? `add(mul(mul(${dynamicCounter ?? prevLocation}_i, ${nestedLength}), 32), ${nestedOffset})`
                : nestedDynamic
                  ? adjustedOffset
                  : config.wordOffset
            }))
            `);
        }
      }
    }

    if (Array.isArray(schema)) {
      schema.forEach(subSchema => {
        const generatedData = generateDecoderLines(
          subSchema,
          name,
          index,
          level,
          nestedDynamic,
          prevLocation,
        );
        lines.push(...generatedData.lines);
        dynamicFields.push(...generatedData.dynamicFields);
        index++;
      });
    } else if (schema.fields) {
      // This is the main struct
      // TODO this will not work for main tuple[]
      if (
        (!schema.fieldName &&
          !schema.isNested &&
          schema.typeName.startsWith('Container')) ||
        schema.length === 0
      ) {
        const generatedData = generateDecoderLines(
          schema.fields,
          name,
          index,
          level,
          nestedDynamic,
          prevLocation,
        );
        return {
          lines: lines.concat(generatedData.lines),
          dynamicFields: dynamicFields.concat(generatedData.dynamicFields),
        };
      }

      if (schema.isDynamic) {
        const innerName = `${schema.fieldName}_${index}_${level}_pos`;
        if (nested) {
          lines.push(`
          // 1 Get position of ${schema.fieldName}
          let ${innerName} := mload(add(${location}, mul(add(${dynamicCounter ?? location}_i, 1), 0x20)))
          `);
        } else {
          lines.push(`
          // 2 Get position of ${schema.fieldName}
          let ${innerName} := and(shr(${256 - config.bitOffset - 32}, memData), 0xFFFFFFFF)
          `);

          lines.push(generateBigEndianConversion(innerName));

          lines.push(`${innerName} := add(${innerName}, ${prevOffset ?? 32})`);
        }

        config.prevSize += 32;
        config.bitOffset += 32;

        // TODO is typeName !== container
        schema.isDynamic = false;
        const isNestedByteList =
          schema.isNested &&
          schema.types[schema.types.length - 1]?.type === 'ByteList' &&
          schema.types[0]?.type === 'List';
        dynamicFields.push({
          positionName: innerName,
          index,
          level,
          location,
          schema:
            schema.length === undefined &&
            schema.fields &&
            !schema.type.includes('tuple') &&
            !isNestedByteList
              ? schema.fields[0]
              : schema,
          isGenerated: false,
        });
      } else {
        let fields = deepCloneArray(schema.fields);

        if (schema.length) {
          fields = Array(schema.length)
            .fill(null)
            .map((_, i) => {
              return {
                ...deepClone(schema),
                length: 0,
                type: schema.type,
                fieldName: `${schema.fieldName}_${i}`,
              };
            });
        }

        let innerName = name + '_' + index;

        if (schema.isNested) {
          if (dynamicCounter && schema.types[0]?.type === 'Vector') {
            lines.push(
              `
              // nested
              let ${innerName} := mload(0x40)
              mstore(add(${location}, ${dynamicCounter ? `mul(add(${dynamicCounter}_i, 1), 0x20)` : 32 * index}), ${innerName})

              mstore(0x40, add(${innerName}, mul(add(${dynamicCounter ?? location}_size, 1), 0x20)))
              `,
            );
          } else {
            innerName = name;
          }

          nestedLength = fields.length;

          const generatedData = generateDecoderLines(
            fields,
            innerName,
            0,
            level + 1,
            nestedDynamic,
            location,
          );
          lines.push(...generatedData.lines);
          dynamicFields.push(...generatedData.dynamicFields);

          nestedLength = undefined;
        } else {
          const generatedData = generateDecoderLines(
            fields,
            innerName,
            0,
            level + 1,
            nestedDynamic,
            location,
          );
          lines.push(`
            // Get address of field at slot ${index} of ${name}
            let ${innerName} := mload(${index ? `add(${name}, ${index * 0x20})` : name})
            ${generatedData.lines.join('\n')}
            `);

          dynamicFields.push(...generatedData.dynamicFields);
        }
      }
    } else if (schema.isDynamic) {
      const fieldName = `${schema.fieldName}_${index}_pos`;
      lines.push(`

        // Get position of ${name}
        let ${fieldName} := and(shr(${256 - config.bitOffset}, memData), 0xFFFFFFFF)
      `);
      lines.push(generateBigEndianConversion(fieldName));

      lines.push(`
          // Update nested dynamic pos
          ${fieldName} := add(${fieldName}, ${nestedDynamic ?? 32})
        `);

      config.prevSize += 32;
      dynamicFields.push({
        positionName: fieldName,
        index,
        level,
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
      if (!schema.length) {
        const isBytesNum =
          schema.type.startsWith('bytes') &&
          schema.type !== 'bytes' &&
          !schema.type.startsWith('bytes[');

        let shift = 0;
        const fieldSize = schema.fixedSize * 8;
        if (isBytesNum) {
          // Handle bytesNum
          if (config.prevSize + fieldSize < 256) {
            shift = -config.prevSize;
            config.prevSize += fieldSize;
          } else {
            config.prevSize = fieldSize;
          }
        } else {
          // Handle non-bytes fields
          if (config.prevSize + fieldSize >= 256) {
            config.prevSize = 0;
          }

          shift = 256 - config.prevSize - fieldSize;
          config.prevSize += fieldSize;
        }

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

    return { lines, dynamicFields };
  };

  const lines: string[] = [];

  const { lines: generatedLines, dynamicFields } = generateDecoderLines(
    schema,
    name,
  );
  lines.push(...generatedLines);

  const clone = (items: any) =>
    items.map((item: any) => (Array.isArray(item) ? clone(item) : item));

  const findNextField = (index: number, level: number, location: string) => {
    const filteredDynamicFields = dynamicFields.filter(
      d => d.location === location,
    );
    const indices = filteredDynamicFields.map(d => d.index);
    indices.sort();
    const currentIndex = indices.findIndex(i => i === index);

    if (currentIndex > -1 && currentIndex < indices.length - 1) {
      return filteredDynamicFields.find(
        d => d.index === indices[currentIndex + 1],
      );
    }

    if (level <= 0) {
      return undefined;
    }

    const splitLocation = location.split('_');
    index = parseInt(splitLocation[splitLocation.length - 1]);
    if (isNaN(index)) {
      index = parseInt(splitLocation[splitLocation.length - 2]);
    }
    location = splitLocation.slice(0, -1).join('_');
    return findNextField(index, level - 1, location);
  };

  const generateDynamicLines = (dynamicData: DynamicData[]) => {
    const lines: string[] = [];

    for (let i = 0; i < dynamicData.length; i++) {
      const currentField = dynamicData[i];
      if (currentField.isGenerated) {
        continue;
      }

      const nextField = findNextField(
        currentField.index,
        currentField.level,
        currentField.location,
      );

      const schema = currentField.schema;
      const isBytesNum =
        schema.type.startsWith('bytes') &&
        schema.type !== 'bytes' &&
        !schema.type.startsWith('bytes[');
      const isDynamic =
        !isBytesNum &&
        (schema.type.startsWith('bytes') || schema.type.startsWith('string'));

      if (nextOffset && schema.prevType?.type !== 'Vector') {
        const newNextOffset = `nextOffset_${currentField.location}_${i}`;
        lines.push(`
            let ${newNextOffset} := 0
            switch eq(${dynamicCounter}_i, sub(${dynamicCounter}_size, 1))
            case 0 {
              // not last
              ${newNextOffset} := mload(add(${currentField.location}, add(0x20, mul(add(${dynamicCounter}_i, 1), 0x20))))
            }
            default {
              // last
              ${newNextOffset} := ${nextOffset}
            }
        `);
        nextOffset = newNextOffset;
      }

      if (schema.fields) {
        lines.push(
          `
          { // fieldName ${currentField.schema.fieldName}; typeName: ${currentField.schema.typeName}; type: ${currentField.schema.type}
            `,
        );

        const nestedDynamic = currentField.positionName;

        config.prevSize = 0;
        config.bitOffset = 0;
        config.wordOffset = 0;

        if (schema.isNested) {
          lines.push(
            generateNestedDynamic(
              currentField,
              currentField.index,
              nextField,
              (index: string | undefined, offset: string, location: string) => {
                const lines: string[] = [];
                if (currentField.schema.isLastDynamic) {
                  const next = nextField
                    ? `${nextField.positionName}`
                    : 'add(32, mload(data))';

                  nextOffset = nested ? 'nextOffset' : next;
                }

                nested = offset;
                dynamicCounter = index;

                const generatedData = generateDecoderLines(
                  {
                    ...schema,
                    fieldName: schema.fieldName + '_' + currentField.index,
                  },
                  location,
                  currentField.index,
                  currentField.level + 1,
                  nestedDynamic,
                );
                lines.push(...generatedData.lines);
                dynamicFields.push(...generatedData.dynamicFields);

                lines.push(
                  ...generateDynamicLines(generatedData.dynamicFields),
                );

                return lines.join('\n');
              },
              nested ? dynamicCounter : undefined,
              nested,
            ),
          );
          nextOffset = undefined;
          nested = undefined;
          dynamicCounter = undefined;
        } else {
          lines.push(`
            memData := mload(add(data, ${nestedDynamic}))
          `);

          if (!schema.isDynamic) {
            config.wordOffset = 0;
          }

          prevOffset = currentField.positionName;
          const data = generateDecoderLines(
            {
              ...schema,
              fieldName: schema.fieldName + '_' + currentField.index,
            },
            currentField.location,
            currentField.index,
            currentField.level + 1,
            nestedDynamic,
          );
          lines.push(...data.lines);

          dynamicFields.push(...data.dynamicFields);
          lines.push(...generateDynamicLines(data.dynamicFields));
        }
        lines.push('}');
      } else if (isDynamic) {
        if (schema.isNested) {
          let innerOffset = currentField.positionName;
          if (dynamicCounter) {
            innerOffset = `${schema.fieldName}_${currentField.index}_${currentField.level + 1}_pos`;
            lines.push(
              `let ${innerOffset} := mload(add(${dynamicCounter}, mul(add(${dynamicCounter}_i, 1), 0x20)))`,
            );
          }

          lines.push(
            generateDecoderStringBytes(
              {
                ...currentField,
                location: dynamicCounter ?? currentField.location,
                positionName: innerOffset,
              },
              i,
              nextField,
              nextOffset,
              nested,
              dynamicCounter,
            ),
          );
        } else {
          lines.push(generateDecoderStringBytes(currentField, i, nextField));
        }
      } else {
        const nextFieldData = nextOffset ?? nextField;
        lines.push(
          generateDecoderPrimitiveLines(
            currentField,
            i,
            isBytesNum,
            nextFieldData,
            nextOffset ? nested : undefined,
            dynamicCounter,
          ),
        );
      }
    }

    return lines;
  };

  lines.push(...generateDynamicLines(dynamicFields.filter(d => !d.level)));

  return lines;
};

function deepClone<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(item => deepClone(item)) as unknown as T;
  }

  const clonedObj: any = {};
  for (const key in value) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      clonedObj[key] = deepClone((value as any)[key]);
    }
  }

  return clonedObj;
}

function deepCloneArray<T>(array: T[]): T[] {
  return array.map(item => deepClone(item));
}
