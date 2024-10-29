// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IHistoricalDataFeed {
  struct Transmission {
    bytes24 value;
    uint64 timestamp;
  }
}
