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

export const isFieldType = (type: string): type is Types.FieldType => {
  if (type.includes('[') && type.endsWith(']')) {
    const baseType = type.slice(0, type.indexOf('['));
    return isFieldType(baseType);
  }
  return Types.types.includes(type);
};

export const toLowerFirstLetter = (name: string): string => {
  if (!name) return '';
  return name.charAt(0).toLowerCase() + name.slice(1);
};

export const toUpperFirstLetter = (name: string) => {
  if (!name) return '';
  return name.charAt(0).toUpperCase() + name.slice(1);
};
