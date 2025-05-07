import { DynamicData, Schema } from '../../utils';

export const generateNestedDynamic = (
  currentField: DynamicData,
  index: number,
  nextField: DynamicData | undefined,
  generateLines: (position: string) => string,
) => {
  const originalField = currentField.positionName;
  const field =
    currentField.positionName + '_' + currentField.level + '_nested_size';
  const fieldName =
    field.split('_')[0] + '_' + index + '_' + currentField.level + '_n';
  currentField.isGenerated = true;

  let generatedSizeLines = nextField?.isGenerated
    ? `
        ${originalField} := add(32, ${originalField})
        let ${field} := sub(${nextField ? nextField.positionName : 'mload(data)'}, ${originalField})
        `
    : `
        let ${field} := sub(${nextField ? nextField.positionName : 'mload(data)'}, ${originalField})
        ${originalField} := add(32, ${originalField})
        `;
  if (currentField.schema.fixedSize) {
    generatedSizeLines = nextField?.isGenerated
      ? `
        ${originalField} := add(32, ${originalField})
        let ${field} := div(sub(${nextField ? nextField.positionName : 'mload(data)'}, ${originalField}), ${currentField.schema.fixedSize})
        `
      : `
        let ${field} := div(sub(${nextField ? nextField.positionName : 'mload(data)'}, ${originalField}), ${currentField.schema.fixedSize})
        ${originalField} := add(32, ${originalField})
        `;
  }

  return `
    {
      ${generatedSizeLines}

      memData := mload(add(data, ${originalField}))

      let ${fieldName} := mload(0x40)
      mstore(${currentField.index ? `add(${currentField.location}, ${currentField.index * 0x20})` : currentField.location}, ${fieldName})

      mstore(0x40, add(${fieldName}, mul(add(${field}, 1), 32)))
      mstore(${fieldName}, ${field})

      shift := ${originalField}
      for {
        let ${fieldName}_i := 0
      } lt(${fieldName}_i, ${field}) {
        ${fieldName}_i := add(${fieldName}_i, 1)
      } {
        let ${fieldName}array := mload(0x40)
        mstore(add(${fieldName}, mul(add(${fieldName}_i, 1), 32)), ${fieldName}array)
        mstore(0x40, add(${fieldName}array, 96))

        ${generateLines(`${fieldName}array`)}

        ${
          currentField.schema.fixedSize
            ? `
          shift := add(shift, ${currentField.schema.fixedSize})
          memData := mload(add(data, shift))
          `
            : ''
        }
      }
    }
  `;
};
