# Template Decoder

This library provides TypeScript decoders for structured data, supporting template-based decoding and multi-decoder logic for SSZ (Simple Serialize) and ABI encode packed formats.

> **Note**: ABI encode packed doesn't pack dynamic arrays of data (less than 32b data). The existing implementation modifies `ethers.solidityPacked` to pack correctly dynamic arrays.

## Features

- **FieldTuple Decoding:** Converts input data into a `FieldTuple` structure, enabling type-safe access and manipulation.
- **WIT to FieldTuple Conversion:** Rust-based converter collapses WIT (WebAssembly Interface Types) values into partial `FieldTuple`, which can be expanded to full JSON `FieldTuple` fields using `expandJsonFields`.
- **Multi Decoder (SSZ):** Supports decoding of union SSZ types.

## Usage

### Generated Files

Decoders are generated based on template definitions. See and run the `TemplateDecoder.test.ts` file for examples.

### Tests

Unit tests are provided to ensure correctness of decoding logic. Run tests with:

```bash
yarn test # for Cancun optimized `mcopy` decoding
yarn test:paris # for normal decode
```

## WIT to `FieldTuple`

A Rust converter is available to collapse WIT values into a partial `FieldTuple`. Use `expandJsonFields` to convert the collapsed tuple into a full JSON object.

## Template Multi Decoder (SSZ Only)

Supports decoding of union SSZ types.

### Unions

Union types are handled by matching the input against possible variants and decoding accordingly.

Example:

```ts
const fields: TupleField = {
  name: 'Test',
  type: 'tuple',
  components: [
    {
      name: 'union',
      type: 'union',
      components: [
        { name: 'none', type: 'none', size: 0 },
        { name: 'integer', type: 'uint32', size: 32 },
      ],
    },
  ],
};

const values = [{ selector: 0, value: null }];
```

### Generated Files

Multi-decoders are generated for supported SSZ types.

### Tests
