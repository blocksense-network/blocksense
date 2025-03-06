import { ExpandedFieldOrArray } from '../../utils';

export const checkForDynamicData = (fields: ExpandedFieldOrArray[]) => {
  let containsDynamicData = false;

  fields.forEach(field => {
    if (Array.isArray(field)) {
      containsDynamicData = containsDynamicData || checkForDynamicData(field);
    } else if (field.isDynamic) {
      containsDynamicData = true;
      return;
    } else if ('components' in field) {
      containsDynamicData =
        containsDynamicData || checkForDynamicData(field.components!);
    }
  });

  return containsDynamicData;
};
