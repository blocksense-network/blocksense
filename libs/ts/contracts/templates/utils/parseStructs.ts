import { ComponentField, Struct, TupleField } from '.';

export const organizeFieldsIntoStructs = (fields: TupleField) => {
  let structs: Struct[] = [];
  let mainStruct = { name: fields.name, fields: [] };

  fields.components.forEach(field => {
    structs.push(...processField(field, mainStruct));
  });
  structs.unshift(mainStruct);

  // Remove duplicate structs (identified by name).
  return structs.reduce((acc: Struct[], struct) => {
    if (!acc.some(s => s.name === struct.name)) {
      acc.push(struct);
    }
    return acc;
  }, []);
};

const processField = (field: ComponentField[number], parentStruct: any) => {
  const structs: Struct[] = [];
  if (field.type.includes('tuple')) {
    let newStruct: Struct = {
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
