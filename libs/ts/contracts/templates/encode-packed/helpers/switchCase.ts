// for generateDecoderFixedBytesLines(...) and generateDecoderPrimitiveLines(...) to align the memData shift
export const generateSwitchCase = (fieldSize: number, condition: string) => {
  const lines: string[] = [];

  lines.push(`  switch ${condition}`);
  lines.push(`  case 1 {`);
  lines.push(`    shift := add(shift, div(prevSizeSum, 8))`);
  lines.push(`  }`);
  lines.push(`  default {`);
  lines.push(`    shift := add(shift, div(sub(offset, ${fieldSize + 32}), 8))`);
  lines.push(`  }`);

  return lines;
};
