import { DynamicData } from '../../utils';

export const generateDecoderStringBytes = (
  currentField: DynamicData,
  index: number,
  nextField: DynamicData | undefined,
) => {
  const field = currentField.positionName;
  const fieldName = field.split('_')[0] + '_' + index;
  currentField.isGenerated = true;

  return `
    {
      ${
        nextField?.isGenerated
          ? `
        ${field} := add(32, ${field})
        let ${field}_size := sub(${nextField ? nextField.positionName : 'mload(data)'}, ${field})
        `
          : `
        let ${field}_size := sub(${nextField ? nextField.positionName : 'mload(data)'}, ${field})
        ${field} := add(32, ${field})
        `
      }

      let ${fieldName} := mload(0x40)
      mstore(${currentField.index ? `add(${currentField.location}, ${currentField.index * 0x20})` : currentField.location}, ${fieldName})

      // take a mod of 32 to update the free memory pointer
      mstore(0x40, add(${fieldName}, and(add(${field}_size, 64), 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFe0)))
      mstore(${fieldName}, ${field}_size)

      mcopy(
        add(${fieldName}, 32),
        add(data, ${field}),
        ${field}_size
      )
    }
  `;
};
