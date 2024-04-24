// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

interface IHistoricDataFeed {
  struct Transmission {
    bytes24 value;
    uint64 timestamp;
  }
}
