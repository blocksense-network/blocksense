import { DecoderData, ExpandedField, GenerateDecoderConfig } from '../utils';
import { generateMemoryAssignment } from './memoryAssignment';
import { generateSwitchCase } from './switchCase';

// primitive types that are not bytes<num> are shifted to the right for Solidity to read
export const generateDecoderPrimitiveLines = (
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
  if (field.size < 256) {
    lines.push(`  let prevSizeSum := 0`);
    lines.push(`  let offset := ${field.size + 32}`);
  }
  lines.push(`  for {`);
  lines.push(`    let ${field.name}_i := 0`);
  if (field.size >= 256) {
    lines.push(`    let shiftBytes := 0`);
  }
  lines.push(`  } lt(${field.name}_i, ${field.name}_size) {`);
  lines.push(`    ${field.name}_i := add(${field.name}_i, 1)`);
  if (field.size < 256) {
    lines.push(`    offset := add(offset, ${field.size})`);
    lines.push(`    prevSizeSum := add(prevSizeSum, ${field.size})`);
  } else {
    lines.push(`    shiftBytes := 32`);
  }
  lines.push(`  } {`);
  if (field.size < 256) {
    lines.push(`    if gt(offset, 256) {`);
    lines.push(`      shift := add(shift, div(prevSizeSum, 8))`);
    lines.push(`      memData := mload(add(data, shift))`);
    lines.push(`      offset := ${field.size}`);
    lines.push(`      prevSizeSum := 0`);
    lines.push(`    }`);
  } else {
    lines.push(`    shift := add(shift, shiftBytes)`);
    lines.push(`    memData := mload(add(data, shift))`);
  }
  lines.push(`    mstore(`);
  lines.push(`      add(${field.name}, mul(0x20, add(${field.name}_i, 1))),`);
  lines.push(
    `      ${field.size < 256 ? `and(shr(sub(256, offset), memData), ${'0x' + 'F'.repeat(field.size / 4)})` : `memData`}`,
  );
  lines.push(`    )`);
  lines.push(`  }`);
  if (field.size < 256) {
    lines.push(...generateSwitchCase(field.size, 'gt(offset, 256)'));
  } else {
    lines.push(`  shift := add(shift, 32)`);
  }
  lines.push(`  memData := mload(add(data, shift))`);
  lines.push(`}`);

  return lines;
};
