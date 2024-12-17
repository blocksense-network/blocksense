// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract AggregatedDataFeedStore {
  address internal constant DATA_FEED_ADDRESS =
    0x0000000100000000000000000000000000000000;
  address internal constant ROUND_ADDRESS =
    0x0000000000000000000000000000000000001000;
  address internal immutable ACCESS_CONTROL;

  /*
    0x0000 - latest blocknumber
    0x0001 - implementation slot (UpgradeableProxy)
    0x0002 - admin slot (UpgradeableProxy)
  */

  constructor(address accessControl) {
    ACCESS_CONTROL = accessControl;
  }

  fallback() external payable {
    /* READ - 1st bit of selector is 1 */
    assembly {
      // Load selector from memory
      let selector := calldataload(0x00)

      /* <selector 1b> <stride 1b> <X feedId length in bytes 1b> <feedId Xb> (<round 2b> <startSlot 4b> <slots 4b> | <startSlot 4b> <slots 4b>) */
      if and(
        selector,
        0x8000000000000000000000000000000000000000000000000000000000000000
      ) {
        let stride := byte(1, selector)
        let feedIdLength := byte(2, selector)
        let feedId := shr(sub(256, shl(3, feedIdLength)), shl(24, selector))
        let data := calldataload(add(feedIdLength, 3))

        // getFeedAtRound(uint8 stride, uintX feedId, uint16 round, uint32 startSlot, uint32 slots) returns (bytes)
        if and(
          selector,
          0x0400000000000000000000000000000000000000000000000000000000000000
        ) {
          let round := shr(240, data)

          let len := 0
          let ptr := mload(0x40)

          let startSlot := shr(224, shl(16, data))
          let slots := shr(224, shl(48, data))
          stride := add(stride, 1)
          // (feedId * 2**13 + round) * (stride + 1)
          let initialPos := add(
            add(
              shl(sub(stride, 1), DATA_FEED_ADDRESS),
              mul(add(mul(feedId, shl(13, 1)), round), stride)
            ),
            startSlot
          )

          for {
            let i := 0
          } lt(i, slots) {
            i := add(i, 1)
            len := add(len, 32)
          } {
            let feedData := sload(add(initialPos, i))
            mstore(add(ptr, len), feedData)
          }

          return(ptr, len)
        }

        // 0x030000000...000 will call both getLatestData and getLatestRound
        // getLatestRound(uint8 stride, uintX feedId) returns (uint16)
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
          0x0100000000000000000000000000000000000000000000000000000000000000
        ) {
          len := 32
          mstore(ptr, round)
        }

        // getLatestData(uint8 stride, uintX feedId, uint32 startSlot, uint32 slots) returns (bytes)
        if and(
          selector,
          0x0200000000000000000000000000000000000000000000000000000000000000
        ) {
          let startSlot := shr(224, data)
          let slots := shr(224, shl(32, data))

          // (feedId * 2**13 + round) * 2**stride
          let initialPos := add(
            add(
              shl(stride, DATA_FEED_ADDRESS),
              mul(add(mul(feedId, shl(13, 1)), round), shl(stride, 1))
            ),
            startSlot
          )

          for {
            let i := 0
          } lt(i, slots) {
            i := add(i, 1)
            len := add(len, 32)
          } {
            let feedData := sload(add(initialPos, i))
            mstore(add(ptr, len), feedData)
          }
        }

        return(ptr, len)
      }
    }

    /* WRITE - 1st bit of selector is 0 */
    address accessControl = ACCESS_CONTROL;

    /*
                                                                                                                        ┌--------------------- round table data --------------------┐
                                                                                                                        │                                                           │
                                      ┌---------------------- feed 1 ----------------------------┬-- feed 2 .. feed N --┼-------------- row 1 --------------┬---- row 2 .. row N ---┤
      ┌────────┬───────────┬──────────┬──────┬────────────┬──────────────┬────────────┬─────┬────┬──────────────────────┬────────────┬─────┬────────────────┬───────────────────────┐
      │selector│blocknumber│# of feeds│stride│index length│feedId + round│bytes length│bytes│data│          ..          │index length│index│round table data│           ..          │
      ├────────┼───────────┼──────────┼──────┼────────────┼──────────────┼────────────┼─────┼────┼──────────────────────┼────────────┼─────┼────────────────┼───────────────────────┤
      │   1b   │    8b     │    4b    │  1b  │     1b     │      Xb      │     1b     │ Yb  │ Zb │          ..          │     1b     │ Xb  │      32b       │           ..          │
      └────────┴───────────┴──────────┴──────┴────────────┴──────────────┴────────────┴─────┴────┴──────────────────────┴────────────┴─────┴────────────────┴───────────────────────┘
                                                    │             ▲         │           ▲ │    ▲                              │         ▲
                                                    └-------------┘         └-----------┘ └----┘                              └---------┘
                                                    X=index length        Y=bytes length Z=bytes                             X=index length
    */
    assembly {
      let ptr := mload(0x40)
      mstore(ptr, shl(96, caller()))

      // call AC and store return value (32 bytes) at memory location ptr
      let success := staticcall(gas(), accessControl, ptr, 20, ptr, 32)

      // revert if call failed or caller not authorized
      if iszero(and(success, mload(ptr))) {
        revert(0, 0)
      }

      mstore(ptr, 0)

      let data := calldataload(0)
      // setFeeds(bytes)
      if eq(byte(0, data), 0) {
        // check if internal blocknumber is already set
        let prevBlockNumber := sload(0x00)
        let newBlockNumber := shr(184, data)

        if eq(prevBlockNumber, newBlockNumber) {
          revert(0x00, 0x00)
        }
        sstore(0x00, newBlockNumber)

        let pointer := 13
        let len := calldatasize()
        let feedsCount := shr(224, shl(72, data))

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
          let metadata := calldataload(pointer)
          let stride := byte(0, metadata)
          if gt(stride, 31) {
            revert(0, 0)
          }

          let strideAddress := shl(stride, DATA_FEED_ADDRESS)

          let indexLength := byte(1, metadata)
          let indexLengthBits := shl(3, indexLength)
          let index := shr(sub(256, indexLengthBits), shl(16, metadata))

          // 5b
          let bytesLength := byte(add(2, indexLength), metadata)
          let bytesToWrite := shr(
            sub(256, shl(3, bytesLength)),
            shl(add(24, indexLengthBits), metadata)
          )

          pointer := add(pointer, add(3, add(indexLength, bytesLength)))

          let cycles := shr(5, bytesToWrite)
          for {
            let j := 0x00
          } lt(j, cycles) {
            j := add(j, 0x01)
            pointer := add(pointer, 0x20)
          } {
            sstore(add(strideAddress, add(index, j)), calldataload(pointer))
          }

          // last cycle
          let lastCycle := mod(bytesToWrite, 0x20)

          if gt(lastCycle, 0x00) {
            let lastCycleData := calldataload(pointer)
            sstore(
              add(strideAddress, add(index, cycles)),
              shr(sub(256, shl(3, lastCycle)), lastCycleData)
            )
            pointer := add(pointer, lastCycle)
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

        } {
          let roundTableData := calldataload(pointer)
          let indexLength := byte(0, roundTableData)
          let index := shr(
            sub(256, shl(3, indexLength)),
            shl(8, roundTableData)
          )
          if gt(index, shl(115, 2)) {
            revert(0, 0)
          }

          pointer := add(pointer, add(indexLength, 33))
          sstore(add(ROUND_ADDRESS, index), calldataload(sub(pointer, 32)))
        }

        return(0x00, 0x00)
      }

      revert(0x00, 0x00)
    }
  }
}
