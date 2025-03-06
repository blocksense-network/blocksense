export const generateBigEndianConversion = (name: string) => {
  return `
    // convert to big endian
    {
      ${name} := or(
        or(and(shr(24, ${name}), 0xFF), and(shr(8, ${name}), 0xFF00)),
        or(
          and(shl(8, ${name}), 0xFF0000),
          and(shl(24, ${name}), 0xFF000000)
        )
      )
    }
  `;
};
