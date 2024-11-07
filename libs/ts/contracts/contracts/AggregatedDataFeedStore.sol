// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract AggregatedDataFeedStore {
  address internal constant DATA_FEED_ADDRESS =
    0x0000000100000000000000000000000000000000;
  address internal constant ROUND_ADDRESS =
    0x0000000000000000000000000000000000001000;
  address internal immutable owner;

  constructor(address owner_) {
    owner = owner_;
  }

  fallback() external payable {
    /* READ */
    assembly {
      // Load selector from memory
      let selector := calldataload(0x00)

      /* <selector 1b> <stride 1b> <feedId 16b> (<round 2b> <slots 1b> | <slots 1b>) */

      if and(
        selector,
        0x7000000000000000000000000000000000000000000000000000000000000000
      ) {
        let stride := shr(248, shl(8, selector))
        let feedId := shr(128, shl(16, selector))

        // getFeedAtRound(uint8 stride, uint128 feedId, uint16 round, uint8 slots) returns (bytes)
        if and(
          selector,
          0x1000000000000000000000000000000000000000000000000000000000000000
        ) {
          let round := shr(240, shl(144, selector))

          let len := 0
          let ptr := mload(0x40)

          let slots := shr(248, shl(160, selector))
          stride := add(stride, 1)
          // (feedId * 2**13 + round) * (stride + 1)
          let initialPos := add(
            shl(sub(stride, 1), DATA_FEED_ADDRESS),
            mul(add(mul(feedId, shl(13, 1)), round), stride)
          )

          for {
            let i := 0
          } lt(i, slots) {
            i := add(i, 1)
            len := add(len, 32)
          } {
            let data := sload(add(initialPos, i))
            mstore(add(ptr, len), data)
          }

          return(ptr, len)
        }

        // 0x600000000...000 will call both getLatestData and getLatestRound
        // getLatestRound(uint8 stride, uint128 feedId) returns (uint16)
        // (2**115 * stride + feedId)/16
        let roundAddress := add(
          ROUND_ADDRESS,
          shr(4, add(mul(shl(115, 1), stride), feedId))
        )
        // feedId%16 * 16
        let pos := shl(4, mod(feedId, 16))
        let round := shr(
          sub(240, pos),
          and(
            sload(roundAddress),
            shr(
              pos,
              0xFFFF000000000000000000000000000000000000000000000000000000000000
            )
          )
        )
        let len := 0
        let ptr := mload(0x40)
        if and(
          selector,
          0x4000000000000000000000000000000000000000000000000000000000000000
        ) {
          len := 32
          mstore(ptr, round)
        }

        // getLatestData(uint8 stride, uint128 feedId, uint8 slots) returns (bytes)
        if and(
          selector,
          0x2000000000000000000000000000000000000000000000000000000000000000
        ) {
          let slots := shr(248, shl(144, selector))
          stride := add(stride, 1)
          // (feedId * 2**13 + round) * (stride + 1)
          let initialPos := add(
            shl(sub(stride, 1), DATA_FEED_ADDRESS),
            mul(add(mul(feedId, shl(13, 1)), round), stride)
          )

          for {
            let i := 0
          } lt(i, slots) {
            i := add(i, 1)
            len := add(len, 32)
          } {
            let data := sload(add(initialPos, i))
            mstore(add(ptr, len), data)
          }
        }

        return(ptr, len)
      }
    }

    /* WRITE */
    address _owner = owner;

    // TODO it is possible to have length for (feedId,round)
    // 0x1a2d80ac <blockNumber 8b> <N number of feeds 4b> <feed1: stride(1b),(feedId,round)(16b),slots(1b),data> <feed2> ... <feedN>
    // the rest is round table updates in the form of <16b index><32b data>
    // note: (feedId,round) is the sum of the feedId and round and should be a single value
    assembly {
      // Check if sender is owner
      if iszero(eq(_owner, caller())) {
        revert(0x00, 0x00)
      }

      // TODO can be done via calldataload() -> change `data` loading
      // Store selector in memory at location 0
      calldatacopy(0x1C, 0x00, 0x04)

      let selector := mload(0x00)
      // setFeeds(bytes)
      if eq(selector, 0) {
        // check if internal blocknumber is already set
        let prevBlockNumber := sload(0x00)
        let data := calldataload(0x04)
        let newBlockNumber := shr(192, data)

        if eq(prevBlockNumber, newBlockNumber) {
          revert(0x00, 0x00)
        }
        sstore(0x00, newBlockNumber)

        let pointer := 16
        let len := calldatasize()
        let feedsCount := shr(
          160,
          and(
            data,
            0x0000000000000000FFFFFFFF0000000000000000000000000000000000000000
          )
        )

        /* feed updates */
        /*
                    ┌───────────────────────────────┐   .........  ┌───────────────────────────────┐
                    │          stride 0 (32b)       │              │        stride 2 (128b)        │
                    │───────────────────────────────│              │───────────────────────────────│
                    ├───┌───┌───┌───┌───┌───┌───┌───┤              ├───────────────┌───────────────┤
          feed id 0 │   │   │   │   │   │   │   │   │    feed id 0 │   │   │   │   │   │   │   │   │
                    ├───└───└───└───└───└───└───└───┤              ├───────────────└───────────────┤
                    │                               │              │                               │
                    │   ...... 2**13 rounds ......  │              │   ...... 2**13 rounds ......  │
                    │                               │              │                               │
                    ├───┌───┌───┌───┌───┌───┌───┌───┤              ├───────────────┌───────────────┤
          feed id 1 │   │   │   │   │   │   │   │   │    feed id 1 │   │   │   │   │   │   │   │   │
                    ├───└───└───└───└───└───└───└───┤              ├───────────────└───────────────┤
                  . │                               │            . │                               │
                  . │   ...... 2**13 rounds ......  │            . │   ...... 2**13 rounds ......  │
                    │                               │              │                               │
          feed id N └───────────────────────────────┘    feed id N └───────────────────────────────┘
        */
        for {
          let i := 0x00
        } lt(i, feedsCount) {
          i := add(i, 0x01)
        } {
          // TODO check if calldatacopy for each value will be cheaper
          let metadata := calldataload(pointer)
          let stride := byte(0, metadata)
          let strideAddress := shl(stride, DATA_FEED_ADDRESS)

          let indexShift := 16
          if gt(stride, 0) {
            indexShift := add(17, shr(3, stride))
          }

          let shifted := shl(3, indexShift)
          let index := shr(
            sub(248, shifted),
            and(
              metadata,
              shr(
                8,
                shl(
                  sub(160, shifted),
                  0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF000000000000000000000000
                )
              )
            )
          )

          // TODO may be more than 1b; or use number of bytes to read?
          let slots := byte(add(1, indexShift), metadata)

          pointer := add(pointer, add(2, indexShift))

          for {
            let j := 0x00
          } lt(j, slots) {
            j := add(j, 0x01)
            pointer := add(pointer, 0x20)
          } {
            sstore(add(strideAddress, add(index, j)), calldataload(pointer))
          }
        }

        /* round table updates */
        /*
                              ┌───────────────────────────────────────────────────────────────┐
                              │                      latest round table                       │
                              │───────────────────────────────────────────────────────────────│
                              ├───┌───┌───┌───┌───┌───┌───┌───┌───┌───┌───┌───┌───┌───┌───┌───┤slot 0
                feed ids 0-15 │2b │2b │2b │ . │ . │ . │ . │ . │ . │ . │ . │ . │ . │2b │2b │2b │
                              ├───└───└───└───└───└───└───└───└───└───└───└───└───└───└───└───┤ 32b
                              │ 0   1   2   3   4   5   6   7   8   9  10  11  12  13  14  15 │
                              │                                                               │
                              │                                                               │
                              │                    .....................                      │
                              │                                                               │
                              ├───┌───┌───┌───┌───┌───┌───┌───┌───┌───┌───┌───┌───┌───┌───┌───┤slot 312
          feed ids 4992-5008  │2b │2b │2b │ . │ . │ . │ . │ . │ . │ . │ . │ . │ . │2b │2b │2b │
                              ├───└───└───└───└───└───└───└───└───└───└───└───└───└───└───└───┤ 32b
                              │                                                               │
                              └───────────────────────────────────────────────────────────────┘

                                max id: (2**115)*32                          max slot: 2**116
        */
        for {

        } lt(pointer, len) {
          pointer := add(pointer, 48)
        } {
          sstore(
            add(ROUND_ADDRESS, shr(128, calldataload(pointer))),
            calldataload(add(pointer, 16))
          )
        }

        return(0x00, 0x00)
      }

      revert(0x00, 0x00)
    }
  }
}
