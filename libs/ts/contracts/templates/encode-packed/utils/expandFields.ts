import {
  ComponentField,
  ExpandedField,
  ExpandedFieldOrArray,
  PrimitiveField,
  TupleField,
} from './types';

export const expandFields = (values: ComponentField): ExpandedField[] => {
  const expandedField = values.map(field => {
    let data: ExpandedFieldOrArray | PrimitiveField | TupleField;
    if ('components' in field && field.type === 'tuple') {
      // This is a tuple field
      data = expandFields(field.components);
    } else if (field.type.includes('[')) {
      // This is an array field (potentially multi-dimensional)
      const dimensions = field.type.match(/\[(\d*)\]/g)!;
      data = expandArray(field.type, dimensions, field);
    } else {
      // This is not an array field, add it as is
      data = field;
    }
    return JSON.parse(JSON.stringify(data));
  });

  return expandedField;
};

export const expandArray = (
  baseType: string,
  dimensions: string[],
  field: ComponentField[number],
): ExpandedFieldOrArray | ExpandedFieldOrArray[] => {
  if (
    dimensions.length === 0 ||
    (!dimensions.some(dim => dim !== '[]') && !field.type.includes('tuple'))
  ) {
    if ('components' in field && baseType === 'tuple') {
      return expandFields(field.components);
    } else if (checkPrimitiveField(field)) {
      return {
        name: field.name,
        type: baseType,
        size: field.size ?? 0,
        iterations: dimensions.length - 1,
        isDynamic: isDynamicType(baseType),
      };
    }
  }

  let lastDynamicDim = -1;
  for (let i = dimensions.length - 1; i >= 0; i--) {
    if (dimensions[i] !== '[]') {
      break;
    }
    lastDynamicDim = i;
  }

  let changed = dimensions.length;
  if (lastDynamicDim > 0) {
    dimensions.splice(lastDynamicDim, dimensions.length - lastDynamicDim);
  }

  const currentDimension = dimensions[dimensions.length - 1];

  const size = currentDimension.match(/\[(\d*)\]/)![1];
  const arraySize = size ? parseInt(size) : 0;

  if (
    checkPrimitiveField(field) &&
    (currentDimension === '[]' || lastDynamicDim > -1)
  ) {
    let components: ExpandedFieldOrArray;
    if (lastDynamicDim === 0) {
      components = expandArray(
        baseType.split('[')[0] + dimensions.slice(0, -1).join(''),
        dimensions.slice(0, -1),
        field,
      ) as ExpandedFieldOrArray;
    } else {
      components = expandArray(
        baseType + dimensions.join(''),
        dimensions,
        field,
      ) as ExpandedFieldOrArray;
    }

    return {
      name: field.name,
      type: baseType,
      size: field.size ?? 0,
      iterations: changed - dimensions.length || 1,
      isDynamic: true,
      components: Array.isArray(components) ? components : [components],
    };
  }

  const result: ExpandedFieldOrArray[] = [];

  for (let i = 0; i < arraySize; i++) {
    const expandedField = expandArray(
      baseType.split('[')[0] + dimensions.slice(0, -1).join(''),
      dimensions.slice(0, -1),
      field,
    );
    result.push(expandedField);
  }

  return result;
};

const isDynamicType = (type: string) => {
  return type === 'bytes' || type === 'string' || type.includes('[]');
};

const checkPrimitiveField = (field: any): field is PrimitiveField => {
  return (
    typeof field === 'object' &&
    field !== null &&
    'name' in field &&
    'type' in field
  );
};
