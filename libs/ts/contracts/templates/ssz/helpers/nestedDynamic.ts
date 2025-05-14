import { Schema, Offset } from '../utils';
import { generateBigEndianConversion } from './convertToBE';

export const generateNestedDynamic = (
  currentSchema: Schema,
  innerSchema: Schema,
  location: string,
  index: number,
  generateLines: (
    newStart: Offset,
    newEnd: Offset,
    newLocation: string,
    newIndex: number,
  ) => string,
  start: Offset,
  end: Offset,
  counter?: string,
) => {
  let name = `${location}${counter ? '_inner' : ''}_${index}`;
  const firstArrayName = `${name}_firstOffset`;
  const size = `${name}_size`;
  const newStart = `${name}_start`;
  const newEnd = `${name}_end`;

  const fieldName = currentSchema.fieldName
    ? currentSchema.fieldName
    : location;

  if (currentSchema.isFirst) {
    name = location;
  }
  if (innerSchema.sszFixedSize) {
    return `
      // Composite Array Fixed Length for ${fieldName}
      let ${size} := div(sub(${end}, ${start}), ${innerSchema.sszFixedSize})
      ${currentSchema.isFirst ? '' : 'let'} ${name} := mload(0x40)

      ${
        currentSchema.typeName.startsWith('Vector')
          ? `mstore(0x40, add(${name}, mul(${size}, 0x20)))`
          : `
          mstore(${name}, ${size})
          mstore(0x40, add(${name}, mul(add(${size}, 1), 0x20)))
        `
      }
      ${
        counter
          ? `mstore(add(${location}, mul(${currentSchema.prevType?.type === 'Vector' ? counter : `add(${counter}, 1)`}, 0x20)), ${name})`
          : currentSchema.isFirst
            ? ''
            : `mstore(${index ? `add(${location}, ${index * 32})` : location}, ${name})`
      }

      for {
        let ${name}_i := 0
      } lt(${name}_i, ${size}) {
        ${name}_i := add(${name}_i, 1)
      } {
        let ${newStart} := add(${start}, mul(${name}_i, ${innerSchema.sszFixedSize}))
        let ${newEnd} := add(${start}, mul(add(${name}_i, 1), ${innerSchema.sszFixedSize}))
        ${generateLines(
          newStart,
          newEnd,
          name,
          currentSchema.typeName.startsWith('Vector') ? 0 : 1,
        )}
      }
    `;
  }

  return `
    // Composite Array Variable Length for ${fieldName}
    {
      let ${firstArrayName} :=  and(
          shr(224, mload(add(data, ${start}))),
          0xFFFFFFFF
        )
      ${generateBigEndianConversion(firstArrayName)}

      ${
        currentSchema.sszFixedSize
          ? `
            ${firstArrayName} := add(${firstArrayName}, ${start})
            let ${size} := div(sub(${end}, ${firstArrayName}), ${currentSchema.sszFixedSize})
          `
          : `
            let ${size} := div(${firstArrayName}, 4)
            ${firstArrayName} := add(${firstArrayName}, ${start})
          `
      }

      ${currentSchema.isFirst ? '' : 'let'} ${name} := mload(0x40)

      ${
        // currentSchema.sszFixedSize ||
        currentSchema.typeName.startsWith('Vector')
          ? `mstore(0x40, add(${name}, mul(${size}, 0x20)))`
          : `
          mstore(${name}, ${size})
          mstore(0x40, add(${name}, mul(add(${size}, 1), 0x20)))
        `
      }
      ${
        counter
          ? `mstore(add(${location}, mul(${currentSchema.prevType?.type === 'Vector' ? counter : `add(${counter}, 1)`}, 0x20)), ${name})`
          : currentSchema.isFirst
            ? ''
            : `mstore(${index ? `add(${location}, ${index * 32})` : location}, ${name})`
      }

      let ${location}_pos := mload(0x40)
      mstore(0x40, add(${location}_pos, mul(add(${size}, 1), 0x20)))

      // Store first array pos
      mstore(${location}_pos, ${firstArrayName})
      for {
        let ${name}_i := 1
      } lt(${name}_i, ${size}) {
        ${name}_i := add(${name}_i, 1)
      } {
        let innerArrayPos := and(
          shr(224, mload(add(data, add(${start}, mul(${name}_i, 4))))),
          0xFFFFFFFF
        )
        ${generateBigEndianConversion('innerArrayPos')}

        innerArrayPos := add(innerArrayPos, ${start})

        mstore(add(${location}_pos, mul(${name}_i, 0x20)), innerArrayPos)
      }
      // Store end array pos
      mstore(add(${location}_pos, mul(${size}, 0x20)), ${end})

      for {
        let ${name}_i := 0
      } lt(${name}_i, ${size}) {
        ${name}_i := add(${name}_i, 1)
      } {
        let ${newStart} := mload(add(${location}_pos, mul(${name}_i, 0x20)))
        let ${newEnd} := mload(add(${location}_pos, mul(add(${name}_i, 1), 0x20)))
        ${generateLines(
          newStart,
          newEnd,
          name,
          currentSchema.typeName.startsWith('Vector') ? 0 : 1,
        )}
      }
    }
  `;
};
