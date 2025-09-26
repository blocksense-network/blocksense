type ParsedCalldataBase = {
  feedsLength: bigint;
  feeds: {
    stride: bigint;
    feedIndex: bigint; // (feedId * 2 ** 13 + index) * 2 ** stride
    feedId: bigint;
    index?: bigint; // index in ring buffer table
    data: string;
  }[];
  ringBufferTable: {
    index: bigint;
    data: string;
  }[];
};

export type ParsedCalldata =
  | (ParsedCalldataBase & {
      blockNumber: bigint;
      sourceAccumulator: never;
      destinationAccumulator: never;
    })
  | (ParsedCalldataBase & {
      blockNumber: never;
      sourceAccumulator: string;
      destinationAccumulator: string;
    });

/** * Decodes calldata for ADFS (Accumulator Data Feed System) contracts.
 * @param calldata - The transaction calldata to decode.
 * @param hasBlockNumber - Whether the calldata includes a block number (default: true).
 * This is left for backward compatibility when history accumulator logic steps in.
 * @returns ParsedCalldata - The decoded calldata containing feeds and ring buffer table.
 * Throws an error if the calldata is invalid to indicate potential issues with the sequencer ADFS serialization logic.
 */
export const decodeADFSCalldata = (args: {
  calldata: string;
  hasBlockNumber?: boolean;
}): { parsedCalldata: ParsedCalldata; errors: Error[] } => {
  const { calldata, hasBlockNumber = true } = args;
  const errors: Error[] = [];
  const parsedCalldata = {} as ParsedCalldata;
  let pointer = 0;

  if (hasBlockNumber) {
    parsedCalldata.blockNumber = BigInt('0x' + calldata.slice(4, 20));
    pointer = 20;
  } else {
    parsedCalldata.sourceAccumulator = '0x' + calldata.slice(4, 68);
    parsedCalldata.destinationAccumulator = '0x' + calldata.slice(68, 132);
    pointer = 132;
  }

  parsedCalldata.feedsLength = BigInt(
    '0x' + calldata.slice(pointer, pointer + 8),
  );
  parsedCalldata.feeds = [];

  pointer += 8;
  for (let i = 0; i < parsedCalldata.feedsLength; i++) {
    // 1b
    const stride = BigInt('0x' + calldata.slice(pointer, pointer + 2));
    pointer += 2;

    // 1b
    const indexInBytesLen = BigInt('0x' + calldata.slice(pointer, pointer + 2));
    pointer += 2;

    // <indexInBytesLen> bytes
    const feedIndex = BigInt(
      '0x' + calldata.slice(pointer, pointer + Number(indexInBytesLen) * 2),
    );
    pointer += Number(indexInBytesLen) * 2;

    // 1b
    const bytesLen = BigInt('0x' + calldata.slice(pointer, pointer + 2));
    pointer += 2;

    // <bytesLen> bytes
    const bytes = BigInt(
      '0x' + calldata.slice(pointer, pointer + Number(bytesLen) * 2),
    );
    pointer += Number(bytesLen) * 2;

    // <bytes> bytes
    const data = '0x' + calldata.slice(pointer, pointer + Number(bytes) * 2);
    pointer += Number(bytes) * 2;

    if (stride > 31n || stride < 0n) {
      errors.push(new Error('invalid stride for feedIndex ' + feedIndex));
    }

    if (
      feedIndex > 2n ** 115n - 1n * 2n ** stride ||
      feedIndex < 2n ** stride
    ) {
      errors.push(new Error('invalid feedIndex ' + feedIndex));
    }

    // feedIndex = (feedId * 2 ** 13 + index) * 2 ** stride
    const feedId = feedIndex / (2n ** stride * 2n ** 13n);

    parsedCalldata.feeds.push({
      stride,
      feedIndex,
      data,
      feedId,
    });
  }

  parsedCalldata.ringBufferTable = [];

  for (; pointer < calldata.length; ) {
    // 1b
    const indexLen = BigInt('0x' + calldata.slice(pointer, pointer + 2));
    pointer += 2;

    // <indexLen> bytes
    const index = BigInt(
      '0x' + calldata.slice(pointer, pointer + Number(indexLen) * 2),
    );
    pointer += Number(indexLen) * 2;

    // data 32b
    const data = '0x' + calldata.slice(pointer, pointer + 64);
    pointer += 64;

    if (index > 2n ** 116n - 1n) {
      errors.push(new Error('invalid ring buffer table index ' + index));
    }

    parsedCalldata.ringBufferTable.push({
      index,
      data,
    });

    const stride = (index * 16n) / 2n ** 115n;
    const splitData = data.slice(2).match(/.{1,4}/g) || [];

    const feedId = (index * 16n) / (2n ** 115n * stride || 1n);
    const feeds = parsedCalldata.feeds.filter(
      feed =>
        feed.stride === stride &&
        feed.feedId >= feedId &&
        feed.feedId < feedId + 16n,
    );

    for (const feed of feeds) {
      const rbIndex = BigInt('0x' + splitData[Number(feed.feedId % 16n)]);
      feed!.index = rbIndex;

      if (rbIndex > 2n ** 13n - 1n) {
        errors.push(
          new Error(
            `invalid ring buffer index ${rbIndex} for feedId ${feed!.feedId}`,
          ),
        );
      }
    }
  }

  return { parsedCalldata, errors };
};
