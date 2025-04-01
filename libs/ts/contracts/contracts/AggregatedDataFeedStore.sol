// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: Copyright (c) 2024-2025 Schelling Point Labs Inc.
pragma solidity ^0.8.24;

//    ___  __         __                           _  __    __                  __
//   / _ )/ /__  ____/ /__ ___ ___ ___  ___ ___   / |/ /__ / /__    _____  ____/ /__
//  / _  / / _ \/ __/  '_/(_-</ -_) _ \(_-</ -_) /    / -_) __/ |/|/ / _ \/ __/  '_/
// /____/_/\___/\__/_/\_\/___/\__/_//_/___/\__/ /_/|_/\__/\__/|__,__/\___/_/ /_/\_\
//    _____   ____  ___    ___   ___  ________
//   / __/ | / /  |/  /   / _ | / _ \/ __/ __/
//  / _/ | |/ / /|_/ /   / __ |/ // / _/_\ \
// /___/ |___/_/  /_/   /_/ |_/____/_/ /___/
//
// Website:         https://blocksense.network/
// Git Repository:  https://github.com/blocksense-network/blocksense

/// @title AggregatedDataFeedStore
/// @author Aneta Tsvetkova
/// @notice Contract that stores data feeds of different strides
contract AggregatedDataFeedStore {
  address internal constant DATA_FEED_ADDRESS =
    0x0000000100000000000000000000000000000000;
  address internal constant ROUND_ADDRESS =
    0x00000000FFf00000000000000000000000000000;
  address internal immutable ACCESS_CONTROL;

  /// @notice Topic to be emitted on update
  /// @dev keccak256("DataFeedsUpdated(uint256)")
  bytes32 internal constant DATA_FEEDS_UPDATE_EVENT_TOPIC =
    0xe64378c8d8a289137204264780c7669f3860a703795c6f0574d925d473a4a2a7;

  /*
    Storage layout:
      Management space: [0 to 2**128-2**116)
        0x0000 - latest blocknumber
        0x0001 - implementation slot (UpgradeableProxy)
        0x0002 - admin slot (UpgradeableProxy)
      Round table: [2**128-2**116 to 2**128)
      Data feed space: [2**128 to 2**160)
  */

  constructor(address accessControl) {
    ACCESS_CONTROL = accessControl;
  }

  fallback() external payable {
    /* READ - 1st bit of selector is 1; selector is 1 byte */
    /* @dev cannot read more than a feed's space -> reading all of feed's historical data is possible */
    assembly {
      // Load selector from memory
      let selector := calldataload(0x00)

      /* <selector 1b> <stride 1b> <feedId 15b> (<round 2b> <startSlot? 4b> <slots? 4b> | <startSlot? 4b> <slots? 4b>) */
      if and(
        selector,
        0x8000000000000000000000000000000000000000000000000000000000000000
      ) {
        let stride := byte(1, selector)

        let feedId := shr(136, shl(16, selector))
        // ensure feedId is in range [0-2**115) and stride is in range [0-32)
        if or(gt(feedId, 0x7ffffffffffffffffffffffffffff), gt(stride, 31)) {
          revert(0, 0)
        }

        let data := calldataload(17)

        selector := shr(248, selector)

        // getFeedAtRound(uint8 stride, uint120 feedId, uint16 round, uint32 startSlot?, uint32 slots?) returns (bytes)
        if eq(selector, 0x86) {
          // how many slots in this stride: 2**stride
          let strideSlots := shl(stride, 1)
          let round := shr(240, data)

          // ensure round is in range [0-8192)
          if gt(round, 0x1fff) {
            revert(0, 0)
          }

          // base feed index: (feedId * 2**13) * 2**stride
          // find start index for round: baseFeedIndex + round * 2**stride
          let startIndex := add(
            shl(stride, shl(13, feedId)),
            shl(stride, round)
          )

          // `startSlot` and `slots` are used to read a slice from the feed
          // check `_callSingleDataFeed` in contracts/libraries/Blocksense.sol for more info about `calldatasize`
          if gt(calldatasize(), 19) {
            // last index of feed: (feedId + 1) * 2**13 * 2**stride - 1
            let lastFeedIndex := sub(shl(stride, shl(13, add(feedId, 1))), 1)

            // read startSlot from calldata
            let startSlot := shr(224, shl(16, data))
            startIndex := add(startIndex, startSlot)

            // strideSlots = slots
            strideSlots := shr(224, shl(48, data))
            if iszero(strideSlots) {
              strideSlots := shl(stride, 1)
            }

            // ensure the caller is not trying to read past the end of the feed
            if gt(add(startIndex, sub(strideSlots, 1)), lastFeedIndex) {
              revert(0, 0)
            }
          }

          let initialPos := add(shl(stride, DATA_FEED_ADDRESS), startIndex)

          let len := 0
          let ptr := mload(0x40)

          switch strideSlots
          // if stride is 0, read 1 slot (no need for a loop - saves gas)
          case 1 {
            mstore(add(ptr, len), sload(initialPos))
            len := 32
          }
          default {
            for {
              let i := 0
            } lt(i, strideSlots) {
              i := add(i, 1)
              len := add(len, 32)
            } {
              let feedData := sload(add(initialPos, i))
              mstore(add(ptr, len), feedData)
            }
          }

          return(ptr, len)
        }

        // feedId%16 * 16
        // mod is represented as `feedId % 2^4 = feedId & (2^4 - 1)`
        let pos := shl(4, and(feedId, 15))
        let round := shr(
          sub(240, pos),
          and(
            sload(
              add(
                ROUND_ADDRESS,
                // find round table slot: (2**115 * stride + feedId)/16
                shr(4, add(shl(115, stride), feedId))
              )
            ),
            shr(
              pos,
              0xFFFF000000000000000000000000000000000000000000000000000000000000
            )
          )
        )
        let len := 0
        let ptr := mload(0x40)

        // 0x83 will call both getLatestRound and getLatestSingleData
        // 0x85 will call both getLatestRound and getLatestData

        // getLatestRound(uint8 stride, uint120 feedId) returns (uint16)
        if and(selector, 0x01) {
          len := 32
          mstore(ptr, round)
        }

        // getLatestSingleData(uint8 stride, uint120 feedId) returns (bytes)
        if and(selector, 0x02) {
          // find start index for round: feedId * 2**13 + round
          let startIndex := add(shl(13, feedId), round)

          // load feed data from storage and store it in memory
          mstore(
            add(ptr, len),
            sload(add(shl(stride, DATA_FEED_ADDRESS), startIndex))
          )

          return(ptr, add(len, 32))
        }

        // getLatestData(uint8 stride, uint120 feedId, uint32 startSlot?, uint32 slots?) returns (bytes)
        if and(selector, 0x04) {
          // how many slots in this stride: 2**stride
          let strideSlots := shl(stride, 1)

          // base feed index: (feedId * 2**13) * 2**stride
          // find start index for round: baseFeedIndex + round * 2**stride
          let startIndex := add(
            shl(stride, shl(13, feedId)),
            shl(stride, round)
          )

          // `startSlot` and `slots` are used to read a slice from the feed
          // check `_callSingleDataFeed` in contracts/libraries/Blocksense.sol for more info about `calldatasize`
          if gt(calldatasize(), 19) {
            // last index of feed: (feedId + 1) * 2**13 * 2**stride - 1
            let lastFeedIndex := sub(shl(stride, shl(13, add(feedId, 1))), 1)

            // read startSlot from calldata
            let startSlot := shr(224, data)
            startIndex := add(startIndex, startSlot)

            // strideSlots = slots
            strideSlots := shr(224, shl(32, data))
            if iszero(strideSlots) {
              strideSlots := shl(stride, 1)
            }

            // ensure the caller is not trying to read past the end of the feed
            if gt(add(startIndex, sub(strideSlots, 1)), lastFeedIndex) {
              revert(0, 0)
            }
          }

          let initialPos := add(shl(stride, DATA_FEED_ADDRESS), startIndex)

          for {
            let i := 0
          } lt(i, strideSlots) {
            i := add(i, 1)
            len := add(len, 32)
          } {
            mstore(add(ptr, len), sload(add(initialPos, i)))
          }
        }

        return(ptr, len)
      }
    }

    /* WRITE - 1st bit of selector is 0 */
    /*
      IMPORTANT!
      Selector 0x00 is reserved for admin operations via Upgradeable Proxy.
      It should never be implemented as a write operation in this contract to prevent selector collisions.
    */
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
      if eq(byte(0, data), 0x01) {
        ///////////////////////////////////
        // Update Blocksense blocknumber //
        ///////////////////////////////////
        let newBlockNumber := shr(192, shl(8, data))
        let prevBlockNumber := sload(0x00)

        // ensure it is strictly increasing
        if eq(gt(newBlockNumber, prevBlockNumber), 0) {
          revert(0x00, 0x00)
        }
        sstore(0x00, newBlockNumber)

        ///////////////////////////////////
        //         Update feeds          //
        ///////////////////////////////////

        let len := calldatasize()
        let feedsCount := shr(224, shl(72, data))
        // selector (1b) + blocknumber (8b) + feeds count (4b) = 13b
        // points to the start of the feeds data
        let pointer := 13

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
          // get correct stride address based on provided stride
          let strideAddress := shl(stride, DATA_FEED_ADDRESS)

          // get length of index (feedId + round)
          let indexLength := byte(1, metadata)
          // bytes to bits as shift op code works with bits (for next line)
          let indexLengthBits := shl(3, indexLength)
          // get index (max: 16b)
          let index := shr(sub(256, indexLengthBits), shl(16, metadata))

          // get length of bytes to write (max: 5b)
          let bytesLength := byte(add(2, indexLength), metadata)
          // get bytes to write based on bytes length above (in most cases will save gas from calldata length)
          let bytesToWrite := shr(
            sub(256, shl(3, bytesLength)),
            shl(add(24, indexLengthBits), metadata)
          )

          // where actual data (to be written) starts
          pointer := add(pointer, add(3, add(indexLength, bytesLength)))

          // divide by 32 to get number of slots to write
          let slots := shr(5, bytesToWrite)
          // remaining bytes to write
          // remainderSlot = bytesToWrite % 32
          let remainderSlot := and(bytesToWrite, 31)

          // cannot write outside stride space
          if gt(
            // calculate address of last slot at which input data will be stored
            add(index, sub(add(slots, gt(remainderSlot, 0)), 1)),
            // maxWriteAddress: next stride address - current stride address - 1
            sub(sub(shl(add(stride, 1), DATA_FEED_ADDRESS), strideAddress), 1)
          ) {
            revert(0, 0)
          }

          // store full 32 bytes data
          for {
            let j := 0x00
          } lt(j, slots) {
            j := add(j, 0x01)
            pointer := add(pointer, 0x20)
          } {
            sstore(add(strideAddress, add(index, j)), calldataload(pointer))
          }

          // store remainder slot (if any)
          if remainderSlot {
            let remainderSlotData := calldataload(pointer)
            sstore(
              add(strideAddress, add(index, slots)),
              shr(sub(256, shl(3, remainderSlot)), calldataload(pointer))
            )
            pointer := add(pointer, remainderSlot)
          }
        }

        ///////////////////////////////////
        //       Update round table      //
        ///////////////////////////////////
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

                                max id: (2**115)*32-1                        max slot index: 2**116-1
        */
        for {

        } lt(pointer, len) {
          pointer := add(pointer, 0x20)
        } {
          let roundTableData := calldataload(pointer)
          // how many bytes to read for index (max: 15b)
          let indexLength := byte(0, roundTableData)
          // get round table index at which to store rounds
          let index := shr(
            sub(256, shl(3, indexLength)),
            shl(8, roundTableData)
          )
          // index must always be less than 2**116
          if gt(index, 0xfffffffffffffffffffffffffffff) {
            revert(0, 0)
          }

          // update pointer to start start of round data
          pointer := add(pointer, add(indexLength, 1))
          sstore(add(ROUND_ADDRESS, index), calldataload(pointer))
        }

        ///////////////////////////////////
        //  Emit DataFeedsUpdated event  //
        ///////////////////////////////////

        // store blocknumber at slot 0 in memory
        mstore(0x00, newBlockNumber)

        // Emit event with new block number
        log1(0x00, 0x20, DATA_FEEDS_UPDATE_EVENT_TOPIC)

        return(0x00, 0x00)
      }

      revert(0x00, 0x00)
    }
  }
}
