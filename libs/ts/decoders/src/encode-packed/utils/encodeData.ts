import { ethers } from 'ethers';
import { TupleField, PrimitiveField } from '../../utils';

export const encodePackedData = (
  fields: PrimitiveField | TupleField,
  values: any, // values can be of any type so it is not possible to specify the type
): string => {
  const [, packedValues] = processFieldsAndEncodeData(
    [fields],
    [structuredClone(values)],
  );

  const maxEPDataSlots = Math.ceil((packedValues[0].length - 2) / 64);

  return packedValues[0].padEnd(maxEPDataSlots * 64 + 2, '0');
};

const processFieldsAndEncodeData = (
  fields: (PrimitiveField | TupleField)[],
  values: any[], // values can be of any type so it is not possible to specify the type
): [(PrimitiveField | TupleField)[], any[]] => {
  const processedFields = fields.map((field, i) => {
    if (field.type.includes('[')) {
      const dimensions = field.type
        .split('[')
        .slice(1)
        .map(dim => dim.replace(']', ''));
      const baseType = field.type.split('[')[0];

      const processArray = (arr: any[], dims: string[]): any => {
        if (dims.length === 0) {
          if (['string', 'bytes'].includes(baseType)) {
            return processStringOrBytes(arr);
          } else if ('components' in field) {
            const [processedComponents, processedValues] =
              processFieldsAndEncodeData(field.components, arr);
            return ethers.solidityPacked(
              processedComponents.map(component => component.type),
              processedValues,
            );
          } else {
            return ethers.solidityPacked([baseType], [arr]);
          }
        }

        const currentDim = dims[dims.length - 1];
        const remainingDims = dims.slice(0, -1);
        const isCurrentDimDynamic = currentDim === '';

        if (isCurrentDimDynamic) {
          const arrayLength = ethers.solidityPacked(['uint32'], [arr.length]);
          const processedSubArrays = arr.map(subArr =>
            processArray(subArr, remainingDims),
          );
          return ethers.concat([arrayLength, ...processedSubArrays]);
        } else {
          return ethers.concat(
            arr.map(subArr => processArray(subArr, remainingDims)),
          );
        }
      };

      values[i] = processArray(values[i], dimensions);
      return { ...field, type: 'bytes' };
    } else if (['string', 'bytes'].includes(field.type)) {
      values[i] = processStringOrBytes(values[i]);
      return { ...field, type: 'bytes' };
    } else if ('components' in field) {
      const [processedComponents, processedValues] = processFieldsAndEncodeData(
        field.components,
        values[i],
      );
      values[i] = ethers.solidityPacked(
        processedComponents.map(component => component.type),
        processedValues,
      );
      return { ...field, type: 'bytes', components: processedComponents };
    }
    return field;
  });

  return [processedFields, values];
};

const processStringOrBytes = (value: any): string => {
  const data = ethers.isBytesLike(value)
    ? value
    : ethers.hexlify(ethers.toUtf8Bytes(value));
  const dataLength = ethers.solidityPacked(['uint32'], [(data.length - 2) / 2]);
  return ethers.concat([dataLength, data]);
};
