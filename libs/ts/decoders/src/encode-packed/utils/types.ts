import type { DecoderData } from '../../utils';

export type DecoderLines = (data: DecoderData, parentIndex?: string) => string;

export type DecoderImplementations = {
  generateDecoderPrimitiveLines: DecoderLines;
  generateDecoderStringBytes: DecoderLines;
};
