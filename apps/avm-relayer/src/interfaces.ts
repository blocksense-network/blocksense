interface KafkaFeedUpdate {
  feedId: bigint;
  value: Buffer;
  endSlotTimestamp: bigint;
}

export interface KafkaMessage {
  blockHeight: bigint;
  updates: Array<KafkaFeedUpdate>;
}
