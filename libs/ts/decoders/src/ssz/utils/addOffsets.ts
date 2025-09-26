import { Offset } from './types';

export const addOffsets = (
  lines: string[] | undefined,
  l: Offset,
  r: Offset,
) => {
  if (typeof l === 'number' && typeof r === 'number') {
    return l + r;
  } else if (typeof l === 'string' && typeof r === 'number') {
    if (r !== 0) {
      return handleOffset(r, l, lines);
    }
    return l;
  } else if (typeof l === 'number' && typeof r === 'string') {
    if (l !== 0) {
      return handleOffset(l, r, lines);
    }
    return r;
  } else if (typeof l === 'string' && typeof r === 'string') {
    if (l.includes('mload')) {
      if (lines) {
        lines.push(`${r} := add(${r}, ${l})`);
        return r;
      }
      return `add(${r}, ${l})`;
    }
    if (lines) {
      lines.push(`${l} := add(${l}, ${r})`);
      return l;
    }
    return `add(${l}, ${r})`;
  }

  throw new Error('Not implemented');
};

const handleOffset = (l: number, r: string, lines?: string[]) => {
  if (!r.includes('mload') && !r.includes('add')) {
    if (lines) {
      lines.push(`${r} := add(${r}, ${l})`);
    } else {
      return `add(${r}, ${l})`;
    }
  }
  if (r.includes('add')) {
    const parsed = parseOffset(r);
    if (typeof parsed.left === 'number') {
      return `${parsed.name}(${parsed.right}, ${parsed.left + l})`;
    } else if (typeof parsed.right === 'number') {
      return `${parsed.name}(${parsed.left}, ${parsed.right + l})`;
    } else {
      if (lines) {
        lines.push(`${parsed.left} := ${parsed.name}(${r}, ${l})`);
        return parsed.left;
      }
      return `${parsed.name}(${r}, ${l})`;
    }
  }

  return r;
};

const parseOffset = (input: string) => {
  const match = input.match(/(\w+)\((.*?),(.*?)\)/);
  if (!match) throw new Error('Invalid function string format');

  const [_, functionName, left, right] = match;
  const leftTrimmed = left.trim();
  const rightTrimmed = right.trim();

  const parseValue = (value: string) => {
    const num = Number(value);
    return isNaN(num) ? value : num;
  };

  return {
    name: functionName,
    left: parseValue(leftTrimmed),
    right: parseValue(rightTrimmed),
  };
};
