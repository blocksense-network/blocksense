import type { PrimitiveField } from './types';

export const checkPrimitiveField = (field: any): field is PrimitiveField => {
  return (
    typeof field === 'object' &&
    field !== null &&
    'name' in field &&
    'type' in field
  );
};
