import type { TransactionResponse } from 'ethers';

export { generateDecoder as generateEPDecoder } from './encode-packed';
export { encodePackedData } from './encode-packed/utils';

export { generateDecoder as generateSSZDecoder } from './ssz';
export { encodeSSZData } from './ssz/utils';

export type { TupleField } from './utils/types';

export type DecoderLibrary = {
  decode(data: string): Promise<unknown>;
};

export type DecoderContract = {
  decode(data: string): Promise<TransactionResponse>;
};
