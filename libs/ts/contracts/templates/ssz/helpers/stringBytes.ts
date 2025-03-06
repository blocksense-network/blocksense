import { DecoderData } from '../../utils';

export const generateDecoderStringBytes = (
  data: DecoderData,
  nextDataPosition: string,
  parentIndex?: string,
) => {
  console.log('parentIndex', parentIndex);
  const { config, field, index, location } = data;
  const fieldName = field.name + '_' + index;
  const shift = `${field.name}_pos`;

  return `

    // Decode ${field.type} for ${field.name}
    {
      let ${fieldName} := mload(0x40)
      mstore(${index ? `add(${location}, ${index * 0x20})` : location}, ${fieldName})
      let ${fieldName}_size := sub(${nextDataPosition}, ${shift})

      // take a mod of 32 to update the free memory pointer
      mstore(0x40, add(${fieldName}, and(add(${fieldName}_size, 64), 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFe0)))
      mstore(${fieldName}, ${fieldName}_size)
      let ${fieldName}_j := 32
      for {
      } lt(${fieldName}_j, ${fieldName}_size) {
        ${fieldName}_j := add(${fieldName}_j, 32)
        ${shift} := add(${shift}, 32)
      } {
        memData := mload(add(data, ${shift}))
        mstore(add(${fieldName}, ${fieldName}_j), memData)
      }
      memData := mload(add(data, ${shift}))
      mstore(add(${fieldName}, ${fieldName}_j), memData)
      ${fieldName}_j := mod(${fieldName}_size, 32)
      if iszero(${fieldName}_j) {
        ${fieldName}_j := 32
      }
      ${shift} := add(${shift}, ${fieldName}_j)
      memData := mload(add(data, ${shift}))
    }
  `;
};
