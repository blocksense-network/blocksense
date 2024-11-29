import { DecoderData, ExpandedField, GenerateDecoderConfig } from '../utils';

export const generateDecoderStringBytes = (
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

  const fieldName = field.name + '_' + index;

  lines.push(`{`);
  lines.push(`  let ${fieldName} := mload(0x40)`);
  lines.push(
    `  let ${fieldName}_size := and(shr(${256 - config.bitOffset - 32}, memData), 0xFFFFFFFF)`,
  );
  if (parentIndex) {
    lines.push(
      `  mstore(add(${location}, mul(add(${parentIndex}, 1), 32)), ${fieldName})`,
    );
  } else {
    lines.push(
      `  mstore(${index ? `add(${location}, ${index * 0x20})` : location}, ${fieldName})`,
    );
  }
  // take a mod of 32 to update the free memory pointer
  lines.push(
    `  mstore(0x40, add(${fieldName}, and(add(${fieldName}_size, 64), 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFe0)))`,
  );
  lines.push(`  mstore(${fieldName}, ${fieldName}_size)`);
  lines.push(`  let ${fieldName}_j := 32`);
  lines.push(`  for {`);
  lines.push(`  } lt(${fieldName}_j, ${fieldName}_size) {`);
  lines.push(`    ${fieldName}_j := add(${fieldName}_j, 32)`);
  lines.push(`    shift := add(shift, 32)`);
  lines.push(`  } {`);
  lines.push(`    memData := mload(add(data, shift))`);
  lines.push(`    mstore(add(${fieldName}, ${fieldName}_j), memData)`);
  lines.push(`  }`);
  lines.push(`  memData := mload(add(data, shift))`);
  lines.push(`  mstore(add(${fieldName}, ${fieldName}_j), memData)`);
  lines.push(`  ${fieldName}_j := mod(${fieldName}_size, 32)`);
  lines.push(`  if iszero(${fieldName}_j) {`);
  lines.push(`    ${fieldName}_j := 32`);
  lines.push(`  }`);
  lines.push(`  shift := add(shift, ${fieldName}_j)`);
  lines.push(`  memData := mload(add(data, shift))`);
  lines.push(`}`);

  return lines;
};
