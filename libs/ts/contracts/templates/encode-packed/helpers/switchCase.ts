// for generateDecoderFixedBytesLines(...) and generateDecoderPrimitiveLines(...) to align the memData shift
export const generateSwitchCase = (fieldSize: number, condition: string) => {
  return `
    switch ${condition}
    case 1 {
      shift := add(shift, div(prevSizeSum, 8))
    }
    default {
      shift := add(shift, div(sub(offset, ${fieldSize + 32}), 8))
    }
  `;
};
