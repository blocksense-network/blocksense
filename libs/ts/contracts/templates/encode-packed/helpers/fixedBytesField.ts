import { DecoderData, ExpandedField, GenerateDecoderConfig } from '../utils';
import { generateMemoryAssignment } from './memoryAssignment';
import { generateSwitchCase } from './switchCase';

// bytes<num> are shifted to the left for Solidity to read
export const generateDecoderFixedBytesLines = (
  data: DecoderData,
  parentIndex?: string,
) => {
  const { config, field, index, location } = data;
  const lines: string[] = [];

  lines.push('');
  lines.push(`// Decode ${field.type} for ${field.name}`);
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
  lines.push(`  let prevSizeSum := 0`);
  lines.push(`  let offset := ${config.bitOffset + 32}`);
  lines.push(`  for {`);
  lines.push(`    let ${field.name}_i := 0`);
  lines.push(`  } lt(${field.name}_i, ${field.name}_size) {`);
  lines.push(`    ${field.name}_i := add(${field.name}_i, 1)`);
  lines.push(`    offset := add(offset, ${field.size})`);
  lines.push(`    prevSizeSum := add(prevSizeSum, ${field.size})`);
  lines.push(`  } {`);
  lines.push(`    if gt(add(offset, ${field.size}), 256) {`);
  lines.push(`      shift := add(shift, div(prevSizeSum, 8))`);
  lines.push(`      memData := mload(add(data, shift))`);
  lines.push(`      offset := 0`);
  lines.push(`      prevSizeSum := 0`);
  lines.push(`    }`);
  lines.push(`    mstore(`);
  lines.push(`      add(${field.name}, mul(0x20, add(${field.name}_i, 1))),`);
  lines.push(`      shl(offset, memData)`);
  lines.push(`    )`);
  lines.push(`  }`);
  lines.push(
    ...generateSwitchCase(field.size, `gt(add(offset, ${field.size}), 256)`),
  );
  lines.push(`  memData := mload(add(data, shift))`);
  lines.push(`}`);

  return lines;
};
