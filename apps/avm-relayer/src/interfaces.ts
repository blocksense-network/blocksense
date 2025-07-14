interface KafkaFeedUpdate {
    feedId: bigint;
    value: Buffer;
    endSlotTimestamp: bigint;
}

export interface KafkaMessage {
    blockHeight: bigint;
    updates: KafkaFeedUpdate[];
}

export interface TransformedBatch {
    feedInputData: bigint[];
    randomNumberOfFeeds: bigint;
    indexRowsLen: bigint;
    blockNumber: bigint;
}

export interface Feed {
    id: bigint;
    index: bigint;
    stride: bigint;
    data: string;
    readParticularFieldSlotOfData?: number;
}
