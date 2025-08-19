type ParsedCalldataBase = {
  feedsLength: bigint;
  feeds: {
    stride: bigint;
    feedIndex: bigint; // (feedId * 2 ** 13 + index) * 2 ** stride
    feedId?: bigint;
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
export const decodeADFSCalldata = (
  calldata: string,
  hasBlockNumber: boolean = true,
): ParsedCalldata => {
  const parsedData = {} as ParsedCalldata;
  let pointer = 0;

  if (hasBlockNumber) {
    parsedData.blockNumber = BigInt('0x' + calldata.slice(4, 20));
    pointer = 20;
  } else {
    parsedData.sourceAccumulator = '0x' + calldata.slice(4, 68);
    parsedData.destinationAccumulator = '0x' + calldata.slice(68, 132);
    pointer = 132;
  }

  parsedData.feedsLength = BigInt('0x' + calldata.slice(pointer, pointer + 8));
  parsedData.feeds = [];

  pointer += 8;
  for (let i = 0; i < parsedData.feedsLength; i++) {
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
      throw new Error('invalid stride');
    }

    if (feedIndex < 0n || feedIndex > 2n ** 115n - 1n) {
      throw new Error('invalid feedIndex');
    }

    parsedData.feeds.push({
      stride,
      feedIndex: feedIndex,
      data,
    });
  }

  parsedData.ringBufferTable = [];

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

    if (index < 0n || index > 2n ** 116n - 1n) {
      throw new Error('invalid index');
    }

    parsedData.ringBufferTable.push({
      index,
      data,
    });

    const stride = (index * 16n) / 2n ** 115n;
    const feedIdIndex = index * 16n - 2n ** 115n * stride;
    const splitData = data.slice(2).match(/.{1,4}/g) || [];
    const indicesNotZero = splitData.map((_, i) => i);

    for (const feedIndex of indicesNotZero) {
      const feedId = BigInt(feedIndex) + feedIdIndex;
      const index = BigInt('0x' + splitData[feedIndex]);
      const indexInFeeds = (feedId * 2n ** 13n + index) * 2n ** stride;
      const feed = parsedData.feeds.find(
        feed => feed.feedIndex === indexInFeeds,
      );
      if (feed) {
        feed.feedId = feedId;
        feed.index = index;

        if (feed.index > 2n ** 13n - 1n) {
          throw new Error('invalid index');
        }
      }
    }
  }

  return parsedData;
};
