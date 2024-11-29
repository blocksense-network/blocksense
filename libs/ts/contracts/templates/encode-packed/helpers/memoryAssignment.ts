// init memory allocation of free memory pointer for dynamic arrays

export const generateMemoryAssignment = (
  bitOffset: number,
  fieldName: string,
  location: string,
  index: number,
  parentIndex?: string,
) => {
  const lines: string[] = [];
  lines.push(`let ${fieldName} := mload(0x40)`);
  lines.push(
    `let ${fieldName}_size := and(shr(${256 - bitOffset - 32}, memData), 0xFFFFFFFF)`,
  );
  if (parentIndex) {
    lines.push(
      `mstore(add(${location}, mul(add(${parentIndex}, 1), 32)), ${fieldName})`,
    );
  } else {
    lines.push(
      `mstore(${index ? `add(${location}, ${index * 0x20})` : location}, ${fieldName})`,
    );
  }
  lines.push(
    `mstore(0x40, add(${fieldName}, mul(add(${fieldName}_size, 1), 32)))`,
  );
  lines.push(`mstore(${fieldName}, ${fieldName}_size)`);

  return lines;
};
