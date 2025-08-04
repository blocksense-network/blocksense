import { DecoderData } from '../../utils';
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
          for {
            let ${field.name}_i := 0
            } lt(${field.name}_i, ${field.name}_size) {
              ${field.name}_i := add(${field.name}_i, 1)
              offset := add(offset, ${field.size})
              prevSizeSum := add(prevSizeSum, ${field.size})
          } {
            if gt(offset, 256) {
              shift := add(shift, div(prevSizeSum, 8))
              memData := mload(add(data, shift))
              offset := ${field.size}
              prevSizeSum := 0
            }
            mstore(
              add(${field.name}, mul(0x20, add(${field.name}_i, 1))),
              and(shr(sub(256, offset), memData), ${'0x' + 'F'.repeat(field.size / 4)})
            )
          }
          ${generateSwitchCase(field.size, 'lt(offset, 256)')}
          memData := mload(add(data, shift))
          `
          : `
          mcopy(
            add(${field.name}, 32),
            add(data, shift),
            shl(5, ${field.name}_size)
          )

          shift := add(shift, shl(5, ${field.name}_size))
          memData := mload(add(data, shift))
        `
      }
    }
  `;
};
