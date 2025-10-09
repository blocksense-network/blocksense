import { generateSwapEndianness32bit } from '../helpers/convertToBE';

import type { BytesRange, Offset, Schema } from '.';
import { addOffsets } from '.';

export const handleFieldRanges = (
  schema: Schema,
  lines: string[],
  location: string,
  start: Offset,
  end: Offset,
  fieldName: string,
): BytesRange[] => {
  if (schema.variableOffsetsPosition!.length === 0) {
    lines.push(`// Container Fixed Length for ${fieldName}`);
    return schema.fieldRangesFixedLen!.map(value => ({
      start: {
        value: value.start,
        isGenerated: false,
      },
      end: {
        value: value.end,
        isGenerated: false,
      },
    }));
  }

  // Read offsets in one pass
  const offsets = handleVariableOffsets(
    schema,
    lines,
    location,
    start,
    schema.variableOffsetsPosition!,
    !!schema.isFirst,
  );
  offsets.push({ value: end.toString(), isGenerated: true });

  lines.push(`// Container variable length for ${fieldName}`);

  // Merge fieldRangesFixedLen + offsets in one array
  let variableIdx = 0;
  let fixedIdx = 0;
  const fieldRanges = new Array<BytesRange>(schema.isFixedLen!.length);

  for (let i = 0; i < schema.isFixedLen!.length; i++) {
    if (schema.isFixedLen![i]) {
      // push from fixLen ranges ++
      const value = schema.fieldRangesFixedLen![fixedIdx++];
      fieldRanges[i] = {
        start: {
          value: value.start,
          isGenerated: false,
        },
        end: {
          value: value.end,
          isGenerated: false,
        },
      };
    } else {
      // push from varLen ranges ++
      fieldRanges[i] = {
        start: offsets[variableIdx],
        end: offsets[variableIdx + 1],
      };
      variableIdx++;
    }
  }
  return fieldRanges;
};

const handleVariableOffsets = (
  schema: Schema,
  lines: string[],
  location: string,
  start: Offset,
  variableOffsetsPosition: number[],
  shouldAppend: boolean = true,
): Array<{ value: string; isGenerated: boolean }> => {
  const offsets = new Array<{ value: string; isGenerated: boolean }>(
    variableOffsetsPosition.length,
  );
  for (let i = 0; i < variableOffsetsPosition.length; i++) {
    const offset = `${schema.fieldName ? schema.fieldName : location}_var_offset_${i}`;
    lines.push(`
      // Get offset
      let ${offset} := and(shr(224, mload(add(data, ${addOffsets(shouldAppend ? lines : undefined, start, variableOffsetsPosition[i])}))), 0xFFFFFFFF)
    `);
    lines.push(generateSwapEndianness32bit(offset));
    offsets[i] = {
      value: offset,
      isGenerated: false,
    };
  }

  return offsets;
};
