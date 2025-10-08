export type EvmVersion = 'cancun' | 'legacy';

export type PrimitiveField = {
  name: string;
  type: string;
  size?: number;
};

export type TupleField = {
  name: string;
  type: string;
  components: ComponentField;
};

export type ComponentField = Array<PrimitiveField | TupleField>;

export type ExpandedField = {
  name: string;
  type: string;
  size: number;
  shift?: number;
  iterations?: number;
  isDynamic?: boolean;
  components?: Exclude<ExpandedFieldOrArray, ExpandedField>;
};

export type ExpandedFieldOrArray = ExpandedField | ExpandedFieldOrArray[];

export type GenerateDecoderConfig = {
  wordOffset: number;
  prevSize: number;
  bitOffset: number;
};

export type DecoderData = {
  config: GenerateDecoderConfig;
  field: ExpandedField;
  location: string;
  index: number;
};

export type Struct = {
  name: string;
  fields: PrimitiveField[];
};

/* Solidity types */

// The number that can be used in fixed/int types
// The numbers are all multiples of 8 up to 256
// 8 | 16 | 24 | ... | 256
export const allowedBits = Array.from({ length: 32 }, (_, i) => (i + 1) * 8);
export type AllowedBits = MapMultiply<Range<1, 33>, 8>;

// The number that can be used in bytes types
// The numbers are from 1 to 32
// 1 | 2 | 3 | ... | 32
export const allowedBytes = Array.from({ length: 32 }, (_, i) => i + 1);
export type AllowedBytes = Range<1, 33>;

export type Bool = 'bool';
export type Address = 'address';

export type Bytes = 'bytes';
export type String = 'string';

export type FixedBytes<N extends AllowedBytes> = `bytes${N}`;
export type Uint<N extends AllowedBits> = `uint${N}`;
export type Int<N extends AllowedBits> = `int${N}`;

export type DynArray<T extends PrimitiveTypes | CompositeTypes> = `${T}[]`;
export type FixedArray<
  T extends PrimitiveTypes | CompositeTypes,
  N extends number,
> = `${T}[${N}]`;

export type Tuple = 'tuple';
export type Union = 'union';

export type PrimitiveTypes =
  | Bool
  | Address
  | Bytes
  | String
  | FixedBytes<AllowedBytes>
  | Uint<AllowedBits>
  | Int<AllowedBits>;
export type CompositeTypes =
  | DynArray<PrimitiveTypes>
  | FixedArray<PrimitiveTypes, number>
  | Tuple
  | Union;

export type FieldType = PrimitiveTypes | CompositeTypes;

const uints = allowedBits.map(bit => `uint${bit}`);
const ints = allowedBits.map(bit => `int${bit}`);
const fixedBytes = allowedBytes.map(byte => `bytes${byte}`);

export const types = [
  'bool',
  'address',
  'bytes',
  'string',
  ...uints,
  ...ints,
  ...fixedBytes,
  'tuple',
  'union',
  'none',
];

/* Helper types */
type BuildTuple<L extends number, T extends any[] = []> = T['length'] extends L
  ? T
  : BuildTuple<L, [...T, any]>;
type Add<A extends number, B extends number> = [
  ...BuildTuple<A>,
  ...BuildTuple<B>,
]['length'] &
  number;
type Multiply<
  A extends number,
  B extends number,
  Accumulator extends number = 0,
  Iterations extends any[] = [],
> = Iterations['length'] extends B
  ? Accumulator
  : Multiply<A, B, Add<Accumulator, A> & number, [...Iterations, any]>;
type MapMultiply<
  TUnion extends number,
  TMultiplier extends number,
> = TUnion extends any ? Multiply<TUnion, TMultiplier> : never;
type Enumerate<
  N extends number,
  Acc extends number[] = [],
> = Acc['length'] extends N
  ? Acc[number]
  : Enumerate<N, [...Acc, Acc['length']]>;
type Range<F extends number, T extends number> = Exclude<
  Enumerate<T>,
  Enumerate<F>
>;
