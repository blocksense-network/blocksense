import * as Types from './types';

export const checkPrimitiveField = (
  field: any,
): field is Types.PrimitiveField => {
  return (
    typeof field === 'object' &&
    field !== null &&
    'name' in field &&
    'type' in field
  );
};

export const expandJsonFields = (
  mainStructName: string,
  inputData: Record<string, Types.TupleField>,
) => {
  const unionTypes: Types.TupleField[] = [];

  const expandJsonFields = (data: Types.TupleField | Types.PrimitiveField) => {
    if ('components' in data) {
      for (const key in data.components) {
        data.components[key] = expandJsonFields(data.components[key]);
      }
    }

    if (isFieldType(data.type)) {
      if (data.type === 'union' && 'components' in data) {
        unionTypes.push(data);
      }
      return data;
    } else {
      let bracketIndex = data.type.indexOf('[');
      if (bracketIndex === -1) {
        bracketIndex = data.type.length;
      }
      const baseType = data.type.slice(0, bracketIndex);
      const arrayPart = data.type.slice(bracketIndex);
      return {
        ...inputData[baseType],
        type: inputData[baseType].type + arrayPart,
      };
    }
  };

  for (const key in inputData) {
    inputData[key] = expandJsonFields(inputData[key]) as Types.TupleField;
  }

  const unionRequirements = unionTypes.flatMap(type =>
    type.components.map(comp => comp.name),
  );

  for (const key in inputData) {
    if (key === mainStructName || unionRequirements.includes(key)) {
      continue;
    }

    delete inputData[key];
  }

  return { inputData, unionTypes };
};

const isFieldType = (type: string): type is Types.FieldType => {
  if (type.includes('[') && type.endsWith(']')) {
    const baseType = type.slice(0, type.indexOf('['));
    return isFieldType(baseType);
  }
  return Types.types.includes(type);
};
