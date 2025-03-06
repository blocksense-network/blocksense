import {
  DecoderData,
  ExpandedField,
  ExpandedFieldOrArray,
  GenerateDecoderConfig,
} from '../../utils';
import { generateDecoderDynamicDataLines } from './dynArrayStringBytes';
import { generateDecoderFixedBytesLines } from './fixedBytesField';
import { generateDecoderPrimitiveLines } from './primitiveField';
import { generateBigEndianConversion } from './convertToBE';
import { generateDecoderStringBytes } from './stringBytes';

type DynamicData = (ExpandedField & {
  gindex?: number;
  alreadyUsed?: boolean;
})[];

export const generateDecoderLines = (
  expandedFields: Exclude<ExpandedFieldOrArray, ExpandedField>,
  name: string,
  isMainStructDynamic: boolean = false,
  dynamicExpandedFields: ExpandedField[] = [],
) => {
  let shouldUpdate = false;
  const config: GenerateDecoderConfig = {
    wordOffset: 32,
    bitOffset: 0,
    prevSize: 0,
  };
  const mainStructName = name;
  const dynamicData: DynamicData = [];
  let shifted = 0;

  console.log('fields', expandedFields);

  // TODO may not work well when dynamic data is within a struct
  const collectDynamicData = (
    fields: ExpandedFieldOrArray[],
    index: number = 0,
  ) => {
    fields.forEach((field, index) => {
      if (Array.isArray(field)) {
        collectDynamicData(field, index);
      } else if (field.isDynamic) {
        dynamicData.push({ ...field, gindex: index });
      } else if ('components' in field) {
        collectDynamicData(field.components!, index);
      }
    });
  };

  collectDynamicData(expandedFields);
  console.log('dynamicData', dynamicData);

  let indexInDynamicData = 0;

  let parentIndex: string | undefined = undefined;
  const generateDynamicLines = (
    dynamicFields: Exclude<DynamicData, ExpandedField>,
    name: string,
    startIndex = 0,
  ) => {
    const lines: string[] = [];
    let index = startIndex;
    let location = name;

    for (let i = 0; i < dynamicFields.length; i++) {
      console.log('shifted', shifted);
      const field = dynamicFields[i];
      console.log('field', field);
      if (field.alreadyUsed) {
        continue;
      }

      config.bitOffset += Array.isArray(field) ? 0 : field.size;
      console.log('bitOffset', config.bitOffset);
      console.log('prevSize', config.prevSize);
      if (
        !Array.isArray(field) &&
        (config.prevSize + (field.size ?? 0) >= 256 || config.bitOffset >= 256)
      ) {
        config.wordOffset += config.prevSize / 8;
        config.bitOffset = field.size ?? 0;
        shouldUpdate = true;
        config.prevSize = 0;
      }

      if (shouldUpdate && config.wordOffset > 32) {
        lines.push(`

          ${config.wordOffset > 0 ? `// Offset data with ${config.wordOffset} bytes` : ''}
          memData := mload(add(data, ${config.wordOffset}))
        `);
        shouldUpdate = false;

        shifted = 0;
      }
      console.log('---> shifted', shifted);

      // Dynamic data
      {
        if ('components' in field || Array.isArray(field)) {
          const innerName = name + '_' + index;
          index = parentIndex ? index : field.gindex;
          lines.push(`
            {
              // Get address of field at slot ${index} of ${name}
              let ${innerName} := mload(${index ? `add(${name}, ${index * 0x20})` : name})
            `);

          const length = Array.isArray(field)
            ? field.length
            : field.components!.length;
          for (let j = 0; j < length; j++) {
            const component = ((field.components ?? field) as ExpandedField[])[
              j
            ];
            if (!component.isDynamic) {
              lines.push(
                generateDecoderLines([component], innerName, j).join('\n'),
              );
              continue;
            }

            if (
              !Array.isArray(field) &&
              (config.prevSize + (field.size ?? 0) >= 256 ||
                config.bitOffset >= 256)
            ) {
              config.wordOffset += config.prevSize / 8;
              config.bitOffset = field.isDynamic ? 0 : (field.size ?? 0);
              shouldUpdate = true;
              config.prevSize = 0;
            }

            if (shouldUpdate && config.wordOffset > 32) {
              lines.push(`

                ${config.wordOffset > 0 ? `// Offset data with ${config.wordOffset} bytes` : ''}
                memData := mload(add(data, ${config.wordOffset}))
              `);
              shouldUpdate = false;

              shifted = 0;
            }

            component.name = component.name + '_' + j;
            shifted += component.size ?? 0;
            lines.push(`

              // Position for ${component.name}
              let ${component.name}_pos := and(shr(${256 - shifted}, memData), 0xFFFFFFFF)`);
            lines.push(generateBigEndianConversion(`${component.name}_pos`));
            lines.push(
              `${component.name}_pos := add(${component.name}_pos, ${field.name}_pos)`,
            );

            config.prevSize += component.size;
          }

          if (Array.isArray(field)) {
            lines.push(generateDecoderLines(field, innerName, 0).join('\n'));
          } else {
            parentIndex = field.name + '_pos';
            lines.push(
              generateDynamicLines(field.components, innerName, 0).join('\n'),
            );
            parentIndex = undefined;
          }

          lines.push('}');
        } else if (field.type === 'bytes' || field.type === 'string') {
          field.alreadyUsed = true;

          let nextPos = 'add(32, mload(data))';
          // if (dynamicData[indexInDynamicData]) {
          //   dynamicData[indexInDynamicData].alreadyUsed = true;
          // }

          if (indexInDynamicData + 1 < dynamicExpandedFields.length) {
            nextPos = `${dynamicExpandedFields[indexInDynamicData + 1].name}_pos`;
          }
          console.log('nextPos', nextPos);
          lines.push(
            generateDecoderStringBytes(
              {
                config,
                field: field as ExpandedField,
                location,
                // TODO make this work with additional field in the field itself
                index: field.gindex || i, //expandedFields.findIndex(f => f.name === field.name)!,
              },
              nextPos,
              parentIndex,
            ),
          );

          indexInDynamicData++;

          config.wordOffset = 0;
          config.prevSize = 0;
          config.bitOffset = 0;
          shifted = 0;
        } else {
          console.log('field', field);
          throw new Error('Unsupported type');
        }
        index++;
      }
    }

    return lines;
  };

  let nestedDynamicData: ExpandedField[] = [];
  const generateDecoderLines = (
    expandedFields: Exclude<ExpandedFieldOrArray, ExpandedField>,
    name: string,
    startIndex = 0,
  ) => {
    const lines: string[] = [];
    let index = startIndex;
    let location = name;

    for (let i = 0; i < expandedFields.length; i++) {
      const field = expandedFields[i];

      config.bitOffset +=
        Array.isArray(field) || field.isDynamic ? 0 : field.size;

      if (
        !Array.isArray(field) &&
        (config.prevSize + (field.size ?? 0) >= 256 || config.bitOffset >= 256)
      ) {
        config.wordOffset += config.prevSize / 8;
        config.bitOffset = field.isDynamic ? 0 : (field.size ?? 0);
        shouldUpdate = true;
        config.prevSize = 0;
      }

      if (shouldUpdate && config.wordOffset > 32) {
        lines.push(`

          ${config.wordOffset > 0 ? `// Offset data with ${config.wordOffset} bytes` : ''}
          memData := mload(add(data, ${config.wordOffset}))
        `);
        shouldUpdate = false;
        shifted = 0;
      }

      if (Array.isArray(field)) {
        const innerName = name + '_' + index;
        let indexInDynamicData = dynamicData.findIndex(
          f => f.name === innerName,
        );
        lines.push(`

          {
            // Get address of field at slot ${index} of ${name}
            let ${innerName} := mload(${index ? `add(${name}, ${index * 0x20})` : name})
            ${generateDecoderLines(field, innerName, 0).join('\n')}
            ${generateDynamicLines(nestedDynamicData, innerName, 0).join('\n')}
          }
        `);

        nestedDynamicData = [];
      } else if (!field.isDynamic) {
        config.prevSize += field.size;
        lines.push(`
          // Store the next ${field.size} bits of memData at slot ${index} of ${location} for ${field.name}
          mstore(${index ? `add(${location}, ${index * 0x20})` : location}, ${field.shift === 0 ? 'memData' : field.shift! < 0 ? `shl(${Math.abs(field.shift!)}, memData)` : field.size < 256 ? `and(shr(${field.shift}, memData), ${'0x' + 'F'.repeat(field.size / 4)})` : `shr(${field.shift}, memData)`})
        `);
      } else {
        throw new Error('Dynamic field not supported');
        // Dynamic data
        lines.push(`

        // Position for ${field.name}
        let ${field.name}_pos := and(shr(${field.shift}, memData), 0xFFFFFFFF)`);
        lines.push(generateBigEndianConversion(`${field.name}_pos`));
        lines.push(`${field.name}_pos := add(32, ${field.name}_pos)`);

        // nested dynamic data
        if (name !== mainStructName) {
          nestedDynamicData.push(field);
        }

        config.prevSize += field.size;
      }

      shifted += field.size ?? 0;
      index++;
    }

    return lines;
  };

  return generateDecoderLines(expandedFields, name).concat(
    // generateDynamicLines(dynamicData, name),
    [],
  );
};
