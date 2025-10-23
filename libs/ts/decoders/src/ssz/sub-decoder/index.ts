import type { Struct } from '../../utils';
import { toUpperFirstLetter } from '../../utils';
import type { UnionSchema } from '../utils';

export const generateSubDecoderLines = (
  subDecoder: string,
  mainStructName: string,
  structs: Struct[],
  unionTypes: UnionSchema[],
  returnType: string,
): string[] => {
  const selectors: string[] = [];
  unionTypes.forEach(ut => {
    selectors.push(`${ut.contractName}Selector`);
  });

  const mainArrayDimensions = (returnType.match(/\[(\d*)\]/g) || []).reverse();
  const mainLoopCode: string[] = [];
  const mainIndexVars = [];

  for (let d = 0; d < mainArrayDimensions.length; d++) {
    const currentDimension = mainArrayDimensions[d].match(/\[(\d*)\]/)
      ? [1]
      : [];
    const idx = `i_${d}`;
    const idxDimensions = mainIndexVars.map(iv => `[${iv}]`).join('');
    mainLoopCode.push(
      `for (uint256 ${idx}; ${idx} < ${currentDimension || `${mainStructName}${idxDimensions}.length`}; ${idx}++) {`,
    );
    mainIndexVars.push(idx);
  }

  const mainStructNameIndexed = `${mainStructName}${mainIndexVars.map(iv => `[${iv}]`).join('')}`;

  function generateSubDecoderLines(
    selector: string,
    ut: UnionSchema,
    structNames: string,
  ): string[] {
    const arrayDimensions = (ut.actualType.match(/\[(\d*)\]/g) || []).reverse();

    const loopCode: string[] = [];
    const indexVars = [];
    for (let d = 0; d < arrayDimensions.length; d++) {
      const currentDimension = arrayDimensions[d].match(/\[(\d*)\]/) ? [1] : [];
      const idx = `j_${d}`;
      const idxDimensions = indexVars.map(iv => `[${iv}]`).join('');
      loopCode.push(
        `for (uint256 ${idx}; ${idx} < ${currentDimension || `${structNames}${idxDimensions}.length`}; ${idx}++) {`,
      );
      indexVars.push(idx);
    }
    const currData = `${structNames}${indexVars.map(iv => `[${iv}]`).join('')}`;
    loopCode.push(`uint8 ${selector} = uint8(bytes1(bytes32(${currData})));`);

    for (let d = 0; d < ut.fields.length; d++) {
      const curr = ut.fields[d];

      const fnTypeArrayDimensions = curr.type.match(/(\[\d*\])+$/);
      const fnType = toUpperFirstLetter(
        fnTypeArrayDimensions
          ? curr.type.replace(fnTypeArrayDimensions[0], '')
          : curr.type,
      );

      const decoderName = `SSZ_${ut.contractName}${subDecoder}`;
      loopCode.push(
        `${d > 0 ? 'else' : ''} if (${decoderName}.is${fnType}(${selector})) {`,
      );
      if (!curr.type.includes('none')) {
        let type = curr.type;
        if (type.includes('tuple')) {
          type =
            decoderName +
            '.' +
            toUpperFirstLetter(curr.fieldName) +
            (type.match(/\[(\d*)\]/g) || []).join('');
        } else if (type.includes('union')) {
          type = type.replace('union', 'bytes');
        }

        loopCode.push(
          `${type} ${curr.typeName.includes('Container') || curr.sszFixedSize === null ? 'memory' : ''} ${curr.fieldName} = ${decoderName}.decode${fnType}(${currData});\n`,
        );
      }

      loopCode.push(
        `emit ${decoderName}.${fnType}(${curr.fieldName.includes('none') ? '' : curr.fieldName});\n`,
      );

      if (curr.type.includes('union')) {
        loopCode.push(
          ...generateSubDecoderLines(
            `${curr.fieldName}Selector`,
            curr as UnionSchema,
            curr.fieldName,
          ),
        );
      } else {
        loopCode.push('\n// Write logic here\n');
      }
      loopCode.push('}');
    }

    for (let d = 0; d < arrayDimensions.length; d++) {
      loopCode.push(`}`);
    }
    return loopCode;
  }

  mainLoopCode.push(
    ...unionTypes
      .map((ut, i) => {
        const selector = selectors[i];

        const struct = (
          structs.find(
            str =>
              str.name.toLowerCase() ===
              ut.structNames[ut.structNames.length - 2],
          ) || structs[0]
        )?.fields.find(f => f.name === ut.fieldName);
        if (!struct) {
          return [];
        }

        const structNames = [
          mainStructNameIndexed,
          ...ut.structNames.slice(1),
        ].join('.');
        return generateSubDecoderLines(selector, ut, structNames);
      })
      .flat(),
  );

  for (let d = 0; d < mainArrayDimensions.length; d++) {
    mainLoopCode.push(`}`);
  }
  return mainLoopCode;
};
