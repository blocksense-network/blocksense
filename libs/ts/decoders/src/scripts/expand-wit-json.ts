import { isFieldType, toLowerFirstLetter } from '../utils/helpers';
import type * as Types from '../utils/types';

export const expandJsonFields = (
  mainStructName: string,
  inputData: Record<string, Types.TupleField>,
) => {
  const expandJsonFields = (data: Types.TupleField | Types.PrimitiveField) => {
    if ('components' in data) {
      for (const key in data.components) {
        data.components[key] = expandJsonFields(data.components[key]);
      }
    }

    if (isFieldType(data.type)) {
      if (data.name === mainStructName) {
        return data;
      }
      return { ...data, name: toLowerFirstLetter(data.name) };
    } else {
      let bracketIndex = data.type.indexOf('[');
      if (bracketIndex === -1) {
        bracketIndex = data.type.length;
      }
      const baseType = data.type.slice(0, bracketIndex);
      const arrayPart = data.type.slice(bracketIndex);
      return {
        ...inputData[baseType],
        name:
          data.name === mainStructName
            ? inputData[baseType].name
            : toLowerFirstLetter(inputData[baseType].name),
        type: inputData[baseType].type + arrayPart,
      };
    }
  };

  for (const key in inputData) {
    inputData[key] = expandJsonFields(inputData[key]) as Types.TupleField;
  }

  for (const key in inputData) {
    if (key !== mainStructName) {
      delete inputData[key];
    }
  }

  return inputData;
};
