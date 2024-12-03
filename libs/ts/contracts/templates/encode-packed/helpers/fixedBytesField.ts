import { DecoderData, ExpandedField, GenerateDecoderConfig } from '../utils';
import { generateMemoryAssignment } from './memoryAssignment';
import { generateSwitchCase } from './switchCase';

// bytes<num> are shifted to the left for Solidity to read
export const generateDecoderFixedBytesLines = (
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
      let prevSizeSum := 0
      let offset := ${config.bitOffset + 32}
      for {
        let ${field.name}_i := 0
      } lt(${field.name}_i, ${field.name}_size) {
        ${field.name}_i := add(${field.name}_i, 1)
        offset := add(offset, ${field.size})
        prevSizeSum := add(prevSizeSum, ${field.size})
      } {
        if gt(add(offset, ${field.size}), 256) {
          shift := add(shift, div(prevSizeSum, 8))
          memData := mload(add(data, shift))
          offset := 0
          prevSizeSum := 0
        }
        mstore(
          add(${field.name}, mul(0x20, add(${field.name}_i, 1))),
          shl(offset, memData)
        )
      }
      ${generateSwitchCase(field.size, `gt(add(offset, ${field.size}), 256)`)}
      memData := mload(add(data, shift))
    }
  `;
};
