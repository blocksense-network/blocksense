import { ExpandedField, ExpandedFieldOrArray } from '../../utils';

export const calculateFieldShift = (fields: ExpandedField[]) => {
  let prevSizeSum = 0;

  const calculateFieldShift = (
    fields: ExpandedFieldOrArray[],
  ): ExpandedFieldOrArray[] => {
    fields.forEach((field: ExpandedFieldOrArray) => {
      if (Array.isArray(field)) {
        // If the field is an array, recursively process its elements
        field = calculateFieldShift(field);
      } else if ('components' in field) {
        // If the field is a struct, recursively process its components
        if (field.isDynamic) {
          prevSizeSum = 0;
        }
        field.components = calculateFieldShift(field.components!);

        if (field.isDynamic) {
          prevSizeSum = 0;
        }
      } else {
        field.shift = 0;
        const isBytes =
          field.type.startsWith('bytes') &&
          field.type !== 'bytes' &&
          !field.type.endsWith('[]');
        const isDynamic =
          field.type === 'bytes' ||
          field.type === 'string' ||
          field.type.endsWith('[]');
        let fieldSize = field.size ?? 0;
        field.size = fieldSize;
        // Handle bytes fields
        if (isBytes) {
          // Handle bytesNum
          if (prevSizeSum + fieldSize < 256) {
            field.shift = -prevSizeSum;
            prevSizeSum += fieldSize;
          } else {
            prevSizeSum = fieldSize;
          }
        } else if (!isDynamic) {
          // Handle non-bytes fields
          if (prevSizeSum + fieldSize >= 256) {
            prevSizeSum = 0;
          }

          field.shift = 256 - prevSizeSum - fieldSize;
          prevSizeSum += fieldSize;
        } else {
          // Handle dynamic data
          field.isDynamic = true;
          prevSizeSum = 0;
        }
      }
    });

    return fields;
  };

  return calculateFieldShift(fields);
};
