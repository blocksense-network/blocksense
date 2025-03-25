import { DynamicData } from '../../utils';

export const generateDecoderStringBytes = (
  currentField: DynamicData,
  index: number,
  nextFieldPositionName?: string | undefined,
) => {
  const field = currentField.positionName;
  const fieldName = field.split('_')[0] + '_' + index;

  return `
    {
      let ${field}_size := sub(${nextFieldPositionName ? nextFieldPositionName : 'mload(data)'}, ${field})
      ${field} := add(32, ${field})
      let memData_${field} := mload(add(data, ${field}))

      let ${fieldName} := mload(0x40)
      mstore(${currentField.index ? `add(${currentField.location}, ${currentField.index * 0x20})` : currentField.location}, ${fieldName})

      // take a mod of 32 to update the free memory pointer
      mstore(0x40, add(${fieldName}, and(add(${field}_size, 64), 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFe0)))
      mstore(${fieldName}, ${field}_size)
      let ${fieldName}_j := 32
      for {
      } lt(${fieldName}_j, ${field}_size) {
        ${fieldName}_j := add(${fieldName}_j, 32)
        ${field} := add(${field}, 32)
      } {
        memData_${field} := mload(add(data, ${field}))
        mstore(add(${fieldName}, ${fieldName}_j), memData_${field})
      }
      memData_${field} := mload(add(data, ${field}))
      mstore(add(${fieldName}, ${fieldName}_j), memData_${field})
    }
  `;
};
