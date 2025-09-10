import type { ComponentField, Struct, TupleField } from '.';

export const organizeFieldsIntoStructs = (fields: TupleField) => {
  let structs: Struct[] = [];
  const mainStruct = { name: fields.name, fields: [] };
  let isInUnion = false;
  let unionStructs: Struct[] = [];

  const processField = (field: ComponentField[number], parentStruct: any) => {
    const structs: Struct[] = [];
    if (field.type.includes('tuple')) {
      const newStruct: Struct = {
        name: field.name.charAt(0).toUpperCase() + field.name.slice(1),
        fields: [],
      };
      if ('components' in field) {
        field.components.forEach(component => {
          if (isInUnion) {
            unionStructs.push(...processField(component, newStruct));
          } else {
            structs.push(...processField(component, newStruct));
          }
        });
      }

      if (isInUnion) {
        unionStructs.push(newStruct);
      } else {
        structs.push(newStruct);
      }

      const arrayDimensions = field.type.match(/(\[\d*\])+$/);
      if (arrayDimensions) {
        parentStruct.fields.push({
          name: field.name,
          type: `${newStruct.name}${arrayDimensions[0]}`,
        });
      } else {
        parentStruct.fields.push({ name: field.name, type: newStruct.name });
      }
    } else if (field.type === 'none') {
      // skip none type
    } else if (field.type.includes('union')) {
      parentStruct.fields.push({ name: field.name, type: 'bytes' });
      isInUnion = true;
      (field as TupleField).components.forEach(component => {
        unionStructs.push(...processField(component, { fields: [] }));
      });
      isInUnion = false;
    } else {
      parentStruct.fields.push({ name: field.name, type: field.type });
    }

    return structs;
  };

  fields.components.forEach(field => {
    structs.push(...processField(field, mainStruct));
  });

  // order structs in order of declaration
  // needs to be reversed due to recursion
  structs.reverse();
  structs.unshift(mainStruct);

  // Remove duplicate structs (identified by name).
  structs = structs.reduce((acc: Struct[], struct) => {
    if (!acc.some(s => s.name === struct.name)) {
      acc.push(struct);
    }
    return acc;
  }, []);

  unionStructs = unionStructs.reduce((acc: Struct[], struct) => {
    if (!acc.some(s => s.name === struct.name)) {
      acc.push(struct);
    }
    return acc;
  }, []);

  return { structs, unionStructs };
};
