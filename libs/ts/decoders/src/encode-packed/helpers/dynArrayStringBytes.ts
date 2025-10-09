import type { DecoderData } from '../../utils';
import type { DecoderLines } from '../utils/types';

import { generateMemoryAssignment } from './memoryAssignment';

// dynamic array of bytes or string data
export const generateDecoderDynamicDataLines = (
  data: DecoderData,
  generateDecoderStringBytes: DecoderLines,
  parentIndex?: string,
) => {
  const { config, field, index, location } = data;
  const dataName = field.name + '_' + index;

  return `

    shift := add(shift, ${config.wordOffset + config.prevSize / 8 + 4})
    {
      ${generateMemoryAssignment(
        config.bitOffset,
        field.name,
        location,
        index,
        parentIndex,
      )}
      memData := mload(add(data, shift))
      for {
        let ${dataName}_i := 0
      } lt(${dataName}_i, ${field.name}_size) {
        ${dataName}_i := add(${dataName}_i, 1)
      } {
        ${(() => {
          config.wordOffset = 0;
          config.prevSize = 0;
          config.bitOffset = 0;
          return '';
        })()}
        ${generateDecoderStringBytes(
          {
            ...data,
            location: field.name,
          },
          dataName + '_i',
        )}
      }
    }
  `;
};
