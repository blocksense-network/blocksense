import { ComponentField, TupleField } from './types';

export const organizeFieldsIntoStructs = (fields: TupleField) => {
  let structs = [];
  let mainStruct = { name: fields.name, fields: [] };

  fields.components.forEach(field => {
    structs.push(...processField(field, mainStruct));
  });
  structs.unshift(mainStruct);

  return Array.from(new Set(structs.map(struct => struct.name))).map(name =>
    structs.find(struct => struct.name === name),
  );
};

const processField = (field: ComponentField[number], parentStruct: any) => {
  const structs = [];
  if (field.type.includes('tuple')) {
    let newStruct = {
      name: field.name.charAt(0).toUpperCase() + field.name.slice(1),
      fields: [],
    };
    if ('components' in field) {
      field.components.forEach(component =>
        structs.push(...processField(component, newStruct)),
      );
    }
    structs.push(newStruct);

    let arrayDimensions = field.type.match(/(\[\d*\])+$/);
    if (arrayDimensions) {
      parentStruct.fields.push({
        name: field.name,
        type: `${newStruct.name}${arrayDimensions[0]}`,
      });
    } else {
      parentStruct.fields.push({ name: field.name, type: newStruct.name });
    }
  } else {
    parentStruct.fields.push({ name: field.name, type: field.type });
  }

  // order structs in order of declaration
  // needs to be reversed due to recursion
  return structs.reverse();
};
