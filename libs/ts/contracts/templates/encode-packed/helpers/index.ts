import {
  DecoderData,
  ExpandedField,
  ExpandedFieldOrArray,
  GenerateDecoderConfig,
} from '../utils';
import { generateDecoderDynamicDataLines } from './dynArrayStringBytes';
import { generateDecoderFixedBytesLines } from './fixedBytesField';
import { generateDecoderPrimitiveLines } from './primitiveField';
import { generateDecoderStringBytes } from './stringBytes';

export const generateDecoderLines = (
  expandedFields: Exclude<ExpandedFieldOrArray, ExpandedField>,
  name: string,
  isMainStructDynamic: boolean,
) => {
  let shouldUpdate = false;
  let shift = false;
  const config: GenerateDecoderConfig = {
    wordOffset: 32,
    bitOffset: 0,
    prevSize: 0,
  };
  const mainStructName = name;

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

      if (shouldUpdate && (config.wordOffset > 32 || shift)) {
        lines.push('');
        if (config.wordOffset > 0) {
          lines.push(`// Offset data with ${config.wordOffset} bytes`);
        }
        lines.push(
          `memData := mload(add(data, ${shift ? (config.wordOffset > 0 ? `add(shift, ${config.wordOffset})` : 'shift') : config.wordOffset}))`,
        );
        lines.push('');
        shouldUpdate = false;
      }

      if (Array.isArray(field)) {
        const innerName = name + '_' + index;
        lines.push('');
        lines.push('{');
        lines.push(`  // Get address of field at slot ${index} of ${name}`);
        lines.push(
          `  let ${innerName} := mload(${index ? `add(${name}, ${index * 0x20})` : name})`,
        );
        const innerLines = generateDecoderLines(field, innerName, 0);
        lines.push(...innerLines);
        lines.push('}');
      } else if (!field.isDynamic) {
        config.prevSize += field.size;
        lines.push(
          `// Store the next ${field.size} bits of memData at slot ${index} of ${location} for ${field.name}`,
        );
        lines.push(
          `mstore(${index ? `add(${location}, ${index * 0x20})` : location}, ${field.shift === 0 ? 'memData' : field.shift! < 0 ? `shl(${Math.abs(field.shift!)}, memData)` : field.size < 256 ? `and(shr(${field.shift}, memData), ${'0x' + 'F'.repeat(field.size / 4)})` : `shr(${field.shift}, memData)`})`,
        );
      } else if (field.type === 'bytes' || field.type === 'string') {
        shift = true;
        lines.push(
          ...generateDecoderStringBytes({ config, field, location, index }),
        );

        config.wordOffset = 0;
        config.prevSize = 0;
        config.bitOffset = 0;
      } else {
        shift = true;

        lines.push(
          ...handleCases(
            { config, field, location, index },
            field.iterations ?? 0,
          ),
        );

        field.size = 0;
        config.wordOffset = 0;
        config.prevSize = 0;
        config.bitOffset = 0;
      }
      index++;
    }

    return lines;
  };

  const handleCases = (data: DecoderData, iterations: number) => {
    const isBytes =
      data.field.type.startsWith('bytes') &&
      data.field.type !== 'bytes' &&
      data.field.type !== 'bytes[]';
    const isDynamic =
      !isBytes &&
      (data.field.type.startsWith('bytes') ||
        data.field.type.startsWith('string'));

    const handleCases = (
      data: DecoderData,
      iterations: number,
      currentLocation: string,
      depth = 0,
      parentIndex?: string,
    ) => {
      const { config, field, location, index } = data;
      const lines: string[] = [];
      if (iterations) {
        lines.push(
          ...handleMultiDimensionalArray(
            data,
            iterations - 1,
            field.type,
            currentLocation,
            depth,
          ),
        );
      } else {
        if (isBytes) {
          lines.push(
            ...generateDecoderFixedBytesLines(
              {
                ...data,
                location: currentLocation,
              },
              parentIndex,
            ),
          );
        } else if (isDynamic) {
          lines.push(
            ...generateDecoderDynamicDataLines(
              {
                ...data,
                location: currentLocation,
              },
              parentIndex,
            ),
          );
        } else {
          lines.push(
            ...generateDecoderPrimitiveLines(
              {
                ...data,
                location: currentLocation,
              },
              parentIndex,
            ),
          );
        }
      }

      return lines;
    };

    // handles the '[]' part of the type
    function handleMultiDimensionalArray(
      data: DecoderData,
      iterations: number,
      type: string,
      currentLocation: string,
      depth = 0,
    ) {
      const { config, field, location, index } = data;
      const lines: string[] = [];
      const innerType = type.slice(0, -2); // Remove last '[]'
      const innerIndex = `i_${location}_${depth}`;
      let innerName = `${location}_${depth}`;
      lines.push('');
      lines.push(
        `// Decode ${type.slice(-2)} of ${field.type} for ${field.name}`,
      );
      lines.push(
        `shift := add(shift, ${config.wordOffset + config.prevSize / 8 + 4})`,
      );
      lines.push('{');
      lines.push(`  // Get address of array at depth ${depth}`);
      // when main struct is a dynamic array
      if (currentLocation === mainStructName && isMainStructDynamic) {
        innerName = currentLocation;
        lines.push(
          `  let ${innerName}_length := and(shr(${256 - config.bitOffset - 32}, memData), 0xFFFFFFFF)`,
        );
      } else {
        lines.push(`  let ${innerName} := mload(0x40)`);
        lines.push(
          `  let ${innerName}_length := and(shr(${256 - config.bitOffset - 32}, memData), 0xFFFFFFFF)`,
        );
        if (depth > 0) {
          lines.push(
            `  mstore(add(${currentLocation}, mul(add(i_${location}_${depth - 1}, 1), 32)), ${innerName})`,
          );
        } else {
          lines.push(
            `  mstore(${index ? `add(${currentLocation}, ${index * 0x20})` : currentLocation}, ${innerName})`,
          );
        }
        lines.push(
          `  mstore(0x40, add(${innerName}, mul(add(${innerName}_length, 1), 32)))`,
        );
      }
      lines.push(`  mstore(${innerName}, ${innerName}_length)`);
      lines.push(`  memData := mload(add(data, shift))`);
      lines.push('');
      lines.push(
        `  for {let ${innerIndex} := 0} lt(${innerIndex}, ${innerName}_length) {${innerIndex} := add(${innerIndex}, 1)} {`,
      );

      config.wordOffset = 0;
      config.prevSize = 0;
      config.bitOffset = 0;

      if ('components' in field && !iterations) {
        lines.push(
          ...handleNestedDynamic(config, field, innerName, depth, innerIndex),
        );
        lines.push(`    memData := mload(add(data, shift))`);
      } else {
        lines.push(
          ...handleCases(
            {
              ...data,
              field: { ...field, type: innerType },
            },
            iterations,
            innerName,
            depth + 1,
            `${innerIndex}`,
          ),
        );
      }

      lines.push('  }');
      lines.push('}');

      return lines;
    }

    // handles the fixed part of the type; handles dynamic arrays of tuples
    function handleNestedDynamic(
      config: GenerateDecoderConfig,
      field: ExpandedFieldOrArray,
      innerName: string,
      depth: number,
      innerIndex: number | string,
    ) {
      const lines: string[] = [];
      const innerLocation = `${innerName}_${depth}`;
      const data = Array.isArray(field) ? field : field.components!;
      if (!Array.isArray(field)) {
        lines.push(`  // Decode ${field.type} for ${field.name}`);
      }
      lines.push('  {');
      lines.push(`    let ${innerLocation} := mload(0x40)`);
      if (typeof innerIndex === 'number') {
        lines.push(
          `    mstore(${innerIndex ? `add(${innerName}, ${innerIndex})` : innerName}, ${innerLocation})`,
        );
      } else {
        lines.push(
          `    mstore(add(${innerName}, mul(add(${innerIndex}, 1), 32)), ${innerLocation})`,
        );
      }
      lines.push(
        `    mstore(0x40, add(${innerLocation}, ${data.length * 32}))`,
      );
      const arrayDepth = getArrayDepth(data);
      if (arrayDepth > 1) {
        lines.push(
          ...data.flatMap((innerField: ExpandedFieldOrArray, index: number) =>
            handleNestedDynamic(
              config,
              innerField,
              `${innerName}_${depth}`,
              depth + 1,
              index * 32,
            ),
          ),
        );
      } else {
        lines.push(...generateDecoderLines(data, innerLocation, 0));
      }
      if (config.wordOffset + config.prevSize / 8) {
        lines.push(
          `    shift := add(shift, ${config.wordOffset + config.prevSize / 8})`,
        );
      }
      lines.push('  }');
      config.wordOffset = 0;
      config.prevSize = 0;

      return lines;
    }

    const getArrayDepth = (value: ExpandedFieldOrArray): number =>
      Array.isArray(value) ? 1 + Math.max(0, ...value.map(getArrayDepth)) : 0;

    return handleCases(data, iterations, data.location);
  };

  return generateDecoderLines(expandedFields, name);
};
