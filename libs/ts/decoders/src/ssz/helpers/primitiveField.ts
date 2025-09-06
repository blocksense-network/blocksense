import { Schema, Offset } from '../utils';

// primitive types that are not bytes<num> are shifted to the right for Solidity to read
export const generateDecoderPrimitiveLines = (
  schema: Schema,
  location: string,
  index: number,
  isBytes: boolean,
  start: Offset,
  end: Offset,
  counter?: string,
) => {
  const fieldName = '_' + schema.fieldName;
  const fieldSize = schema.fixedSize * 8;

  return `
    // List basic for ${schema.fieldName}
    {
      let ${fieldName}_size := div(sub(${end}, ${start}), ${schema.fixedSize})

      let ${fieldName} := mload(0x40)
      ${
        counter
          ? `mstore(add(${location}, mul(add(${counter}, 1), 0x20)), ${fieldName})`
          : `mstore(${index ? `add(${location}, ${index * 0x20})` : location}, ${fieldName})`
      }

      mstore(0x40, add(${fieldName}, mul(add(${fieldName}_size, 1), 32)))
      mstore(${fieldName}, ${fieldName}_size)

      ${
        fieldSize < 256
          ? `
        let memData := mload(add(data, ${start}))

        let shift := ${start}
        let offset := ${isBytes ? 0 : fieldSize}
        for {
          let ${fieldName}_i := 0
          ${fieldSize >= 256 ? `let shiftBytes := 0` : ''}
        } lt(${fieldName}_i, ${fieldName}_size) {
          ${fieldName}_i := add(${fieldName}_i, 1)
          offset := add(offset, ${fieldSize})
        } {
          if gt(${isBytes ? `add(offset, ${fieldSize})` : 'offset'}, 256) {
            shift := add(shift, div(${isBytes ? 'offset' : `sub(offset, ${fieldSize})`}, 8))
            memData := mload(add(data, shift))
            offset := ${isBytes ? 0 : fieldSize}
          }
          mstore(
            add(${fieldName}, mul(0x20, add(${fieldName}_i, 1))),
            ${
              isBytes
                ? `shl(offset, memData)`
                : `and(shr(sub(256, offset), memData), ${'0x' + 'F'.repeat(fieldSize / 4)})`
            }
          )
        }
        `
          : `
        for {
          let ${fieldName}_i := 0
        } lt(${fieldName}_i, ${fieldName}_size) {
          ${fieldName}_i := add(${fieldName}_i, 1)
        } {
          mstore(
            add(${fieldName}, mul(0x20, add(${fieldName}_i, 1))),
            mload(add(data, add(${start}, mul(32, ${fieldName}_i))))
          )
        }
        `
      }
    }
  `;
};
