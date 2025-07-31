export { generateDecoder as generateEPDecoder } from './encode-packed';
export { encodePackedData } from './encode-packed/utils';

export { generateDecoder as generateSSZDecoder } from './ssz';
export { encodeSSZData } from './ssz/utils';

export type { TupleField } from './utils/types';

export type DecoderContract = {
  decode(data: string): Promise<unknown>;
};
