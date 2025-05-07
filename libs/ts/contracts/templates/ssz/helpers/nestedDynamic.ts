import { DynamicData, Schema } from '../../utils';
import { generateBigEndianConversion } from './convertToBE';

export const generateNestedDynamic = (
  currentField: DynamicData,
  index: number,
  nextField: DynamicData | undefined,
  generateLines: (
    index: string | undefined,
    offset: string,
    location: string,
  ) => string,
  counter?: string,
  prevOffset?: string,
) => {
  const name = currentField.positionName + '_' + currentField.level;
  const firstArrayName = `firstArray_${name}`;
  const size = `${name}_size`;
  const offset = currentField.positionName;

  // schema is a list
  if (
    currentField.schema.types[0]?.type === 'List' &&
    !currentField.schema.type.startsWith('tuple')
  ) {
    return `
    // Dynamic
    {
      // ${offset} := add(${offset}, ${counter ? prevOffset : 32})
      ${
        counter && currentField.schema.isLastDynamic
          ? `
            let nextOffset := 0
            switch eq(${counter}_i, sub(${counter}_size, 1))
            case 0 {
              // not last
              nextOffset := mload(add(${currentField.location}, add(0x20, mul(add(${counter}_i, 1), 0x20))))
            }
            default {
              // last
              nextOffset := ${nextField ? nextField.positionName : 'add(32, mload(data))'}
            }
          `
          : ''
      }


      let ${firstArrayName} :=  and(
          shr(224, mload(add(data, ${offset}))),
          0xFFFFFFFF
        )
      ${generateBigEndianConversion(firstArrayName)}

      ${
        currentField.schema.length
          ? `let ${size} := ${currentField.schema.length}`
          : `let ${size} := div(${firstArrayName}, 4)`
      }
      let ${name} := mload(0x40)
      mstore(${name}, ${size})
      mstore(0x40, add(${name}, mul(add(${size}, 1), 0x20)))
      ${
        counter
          ? `mstore(add(${currentField.location}, mul(add(${counter}_i, 1), 0x20)), ${name})`
          : `mstore(${index ? `add(${currentField.location}, ${index * 32})` : currentField.location}, ${name})`
      }

      for {
        let ${name}_i := 0
      } lt(${name}_i, ${size}) {
        ${name}_i := add(${name}_i, 1)
      } {
        let innerArrayPos := and(
          shr(224, mload(add(data, add(${offset}, mul(${name}_i, 4))))),
          0xFFFFFFFF
        )
        ${generateBigEndianConversion('innerArrayPos')}

        innerArrayPos := add(innerArrayPos, ${offset})

        mstore(add(${name}, add(0x20, mul(${name}_i, 0x20))), innerArrayPos)
      }

      for {
        let ${name}_i := 0
      } lt(${name}_i, ${size}) {
        ${name}_i := add(${name}_i, 1)
      } {
        ${generateLines(name, offset, name)}
      }
    }
  `;
  }

  // schema is a vector
  return `
    // Vector
    {
      ${
        currentField.schema.fixedSize
          ? `let ${size} := div(sub(${nextField ? nextField.positionName : 'add(mload(data), 0x20)'}, ${offset}), ${currentField.schema.fixedSize})`
          : ''
      }
      // ${offset} := add(${offset}, ${counter ? prevOffset : 32})

      let ${name} := mload(0x40)
      ${
        counter
          ? `mstore(add(${currentField.location}, mul(add(${counter}_i, 1), 0x20)), ${name})`
          : `mstore(${index ? `add(${currentField.location}, ${index * 32})` : currentField.location}, ${name})`
      }

      mstore(0x40, add(${name}, ${currentField.schema.fixedSize ? `mul(add(${size}, 1), 0x20)` : currentField.schema.length! * 32}))
      ${
        currentField.schema.fixedSize
          ? `
          mstore(${name}, ${size})
          for {
            let ${name}_i := 0
          } lt(${name}_i, ${size}) {
            ${name}_i := add(${name}_i, 1)
          } {
            memData := mload(add(data, add(mul(${name}_i, ${currentField.schema.fixedSize}), ${offset})))
            ${generateLines(name, offset, name)}
          }
          `
          : `
            memData := mload(add(data, ${offset}))
            ${generateLines(undefined, offset, name)}
          `
      }
    }
  `;
};
