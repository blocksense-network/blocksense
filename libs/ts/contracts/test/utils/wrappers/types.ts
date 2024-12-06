export enum ReadOp {
  GetFeedAtRound = 0x04,
  GetLatestFeed = 0x02,
  GetLatestRound = 0x01,
  GetLatestFeedAndRound = 0x03,
}

export interface Feed {
  id: bigint;
  round: bigint;
  stride: bigint;
  data: string;
}
