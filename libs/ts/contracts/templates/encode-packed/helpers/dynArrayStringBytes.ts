import { DecoderData, ExpandedField, GenerateDecoderConfig } from '../utils';
import { generateMemoryAssignment } from './memoryAssignment';
import { generateDecoderStringBytes } from './stringBytes';

// dynamic array of bytes or string data
export const generateDecoderDynamicDataLines = (
  data: DecoderData,
  parentIndex?: string,
) => {
  const { config, field, index, location } = data;
  const lines: string[] = [];

  const dataName = field.name + '_' + index;

  lines.push('');
  lines.push(
    `shift := add(shift, ${config.wordOffset + config.prevSize / 8 + 4})`,
  );
  lines.push(`{`);
  lines.push(
    ...generateMemoryAssignment(
      config.bitOffset,
      field.name,
      location,
      index,
      parentIndex,
    ),
  );
  lines.push(`  memData := mload(add(data, shift))`);
  lines.push(`  for {`);
  lines.push(`    let ${dataName}_i := 0`);
  lines.push(`  } lt(${dataName}_i, ${field.name}_size) {`);
  lines.push(`    ${dataName}_i := add(${dataName}_i, 1)`);
  lines.push(`  } {`);

  config.wordOffset = 0;
  config.prevSize = 0;
  config.bitOffset = 0;

  lines.push(
    ...generateDecoderStringBytes(
      {
        ...data,
        location: field.name,
      },
      dataName + '_i',
    ),
  );
  lines.push(`  }`);
  lines.push(`}`);

  return lines;
};
