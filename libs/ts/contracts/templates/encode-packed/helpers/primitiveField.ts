import { DecoderData } from '../utils';
import { generateMemoryAssignment } from './memoryAssignment';
import { generateSwitchCase } from './switchCase';

// primitive types that are not bytes<num> are shifted to the right for Solidity to read
export const generateDecoderPrimitiveLines = (
  data: DecoderData,
  parentIndex?: string,
) => {
  const { config, field, index, location } = data;

  return `

    // Decode ${field.type} for ${field.name}
    shift := add(shift, ${config.wordOffset + config.prevSize / 8 + 4})
    {
      ${generateMemoryAssignment(
        config.bitOffset,
        field.name,
        location,
        index,
        parentIndex,
      )}
      ${
        field.size < 256
          ? `
        let prevSizeSum := 0
        let offset := ${field.size + 32 + config.bitOffset}
      `
          : ''
      }
      for {
        let ${field.name}_i := 0
        ${field.size >= 256 ? `let shiftBytes := 0` : ''}
        } lt(${field.name}_i, ${field.name}_size) {
          ${field.name}_i := add(${field.name}_i, 1)
          ${
            field.size < 256
              ? `
              offset := add(offset, ${field.size})
              prevSizeSum := add(prevSizeSum, ${field.size})
            `
              : `shiftBytes := 32`
          }
      } {
        ${
          field.size < 256
            ? `
            if gt(offset, 256) {
              shift := add(shift, div(prevSizeSum, 8))
              memData := mload(add(data, shift))
              offset := ${field.size}
              prevSizeSum := 0
            }
          `
            : `
            shift := add(shift, shiftBytes)
            memData := mload(add(data, shift))
          `
        }
        mstore(
          add(${field.name}, mul(0x20, add(${field.name}_i, 1))),
          ${field.size < 256 ? `and(shr(sub(256, offset), memData), ${'0x' + 'F'.repeat(field.size / 4)})` : `memData`}
        )
      }
      ${
        field.size < 256
          ? `${generateSwitchCase(field.size, 'gt(offset, 256)')}`
          : `shift := add(shift, 32)`
      }
      memData := mload(add(data, shift))
    }
  `;
};
