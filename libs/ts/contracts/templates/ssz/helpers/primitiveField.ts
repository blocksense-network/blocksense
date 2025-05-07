import { DynamicData } from '../../utils';

// primitive types that are not bytes<num> are shifted to the right for Solidity to read
export const generateDecoderPrimitiveLines = (
  currentField: DynamicData,
  index: number,
  isBytes: boolean,
  nextField: DynamicData | string | undefined,
  nextOffset?: string,
  counter?: string,
) => {
  const field = currentField.positionName;
  const fieldName = field.split('_')[0] + '_' + index;
  const fieldSize = currentField.schema.fixedSize * 8;
  const nextFieldOffset =
    typeof nextField !== 'string'
      ? nextField
        ? nextField.positionName
        : 'add(mload(data), 0x20)'
      : nextField;

  return `

    // Decode ${currentField.schema.type} for ${field}
    {

      let ${field}_size := div(sub(${nextFieldOffset}, ${field}), ${currentField.schema.fixedSize})

      let ${fieldName} := mload(0x40)
      ${
        nextOffset
          ? `mstore(add(${currentField.location}, mul(add(${counter}_i, 1), 0x20)), ${fieldName})`
          : `mstore(${currentField.index ? `add(${currentField.location}, ${currentField.index * 0x20})` : currentField.location}, ${fieldName})`
      }

      mstore(0x40, add(${fieldName}, mul(add(${field}_size, 1), 32)))
      mstore(${fieldName}, ${field}_size)

      ${
        fieldSize < 256
          ? `
        memData := mload(add(data, ${field}))

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
                memData := mload(add(data, shift))
                offset := ${isBytes ? 0 : fieldSize}
              }
            `
              : `
              shift := add(shift, shiftBytes)
              memData := mload(add(data, shift))
            `
          }
          mstore(
            add(${fieldName}, mul(0x20, add(${fieldName}_i, 1))),
            ${
              isBytes
                ? `shl(offset, memData)`
                : `${fieldSize < 256 ? `and(shr(sub(256, offset), memData), ${'0x' + 'F'.repeat(fieldSize / 4)})` : `memData`}`
            }
          )
        }
        `
          : `
        mcopy(
          add(${fieldName}, 32),
          add(data, ${field}),
          shl(5, ${field}_size)
        )
        `
      }
    }
  `;
};
