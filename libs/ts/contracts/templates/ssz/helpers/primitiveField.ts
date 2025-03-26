import { DynamicData } from '../../utils';

// primitive types that are not bytes<num> are shifted to the right for Solidity to read
export const generateDecoderPrimitiveLines = (
  currentField: DynamicData,
  index: number,
  isBytes: boolean,
  nextFieldPositionName?: string | undefined,
) => {
  const field = currentField.positionName;
  const fieldName = field.split('_')[0] + '_' + index;
  const fieldSize = currentField.schema.fixedSize * 8;
  console.log('fieldSize', fieldSize);

  return `

    // Decode ${currentField.schema.type} for ${field}
    {
      let ${field}_size := div(sub(${nextFieldPositionName ? nextFieldPositionName : 'mload(data)'}, ${field}), ${currentField.schema.fixedSize})
      ${field} := add(32, ${field})
      let memData_${field} := mload(add(data, ${field}))

      let ${fieldName} := mload(0x40)
      mstore(${currentField.index ? `add(${currentField.location}, ${currentField.index * 0x20})` : currentField.location}, ${fieldName})

      mstore(0x40, add(${fieldName}, mul(add(${field}_size, 1), 32)))
      mstore(${fieldName}, ${field}_size)


      let shift := ${field}
      ${fieldSize < 256 || isBytes ? `let offset := ${isBytes ? 0 : fieldSize}` : ''}
      for {
        let ${fieldName}_i := 0
        ${fieldSize >= 256 ? `let shiftBytes := 0` : ''}
        } lt(${fieldName}_i, ${field}_size) {
          ${fieldName}_i := add(${fieldName}_i, 1)
          ${
            fieldSize < 256
              ? `
              offset := add(offset, ${fieldSize})
            `
              : `shiftBytes := 32`
          }
      } {
        ${
          fieldSize < 256
            ? `
            if gt(${isBytes ? `add(offset, ${fieldSize})` : 'offset'}, 256) {
              shift := add(shift, div(${isBytes ? 'offset' : `sub(offset, ${fieldSize})`}, 8))
              memData_${field} := mload(add(data, shift))
              offset := ${isBytes ? 0 : fieldSize}
            }
          `
            : `
            shift := add(shift, shiftBytes)
            memData_${field} := mload(add(data, shift))
          `
        }
        mstore(
          add(${fieldName}, mul(0x20, add(${fieldName}_i, 1))),
          ${
            isBytes
              ? `shl(offset, memData_${field})`
              : `${fieldSize < 256 ? `and(shr(sub(256, offset), memData_${field}), ${'0x' + 'F'.repeat(fieldSize / 4)})` : `memData_${field}`}`
          }
        )
      }
    }
  `;
};
