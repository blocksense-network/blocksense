// init memory allocation of free memory pointer for dynamic arrays

export const generateMemoryAssignment = (
  bitOffset: number,
  fieldName: string,
  location: string,
  index: number,
  parentIndex?: string,
) => {
  return `
    let ${fieldName} := mload(0x40)
    let ${fieldName}_size := and(shr(${256 - bitOffset - 32}, memData), 0xFFFFFFFF)
    ${
      parentIndex
        ? `mstore(add(${location}, mul(add(${parentIndex}, 1), 32)), ${fieldName})`
        : `mstore(${index ? `add(${location}, ${index * 0x20})` : location}, ${fieldName})`
    }
    mstore(0x40, add(${fieldName}, mul(add(${fieldName}_size, 1), 32)))
    mstore(${fieldName}, ${fieldName}_size)
  `;
};
