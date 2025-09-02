// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Decoder for stored packed tuple data
library SportsEPDecoderLib {
  /// @notice User defined struct
  /// @dev Using structs avoids hitting the EVM stack limit
  struct SportsData {
    bool isOvertime;
    bool isFinal;
    uint16 homeScore;
    uint16 awayScore;
    string homeTeamName;
    string awayTeamName;
    string[6] homePlayers;
    string[6] awayPlayers;
  }

  function decode(
    bytes memory data
  ) internal pure returns (SportsData memory sportsData) {
    assembly ('memory-safe') {
      // First 32 bytes are the length of the data
      let memData := mload(add(data, 32))
      let shift := 0

      // Store the next 8 bits of memData at slot 0 of sportsData for isOvertime
      mstore(sportsData, and(shr(248, memData), 0xFF))

      // Store the next 8 bits of memData at slot 1 of sportsData for isFinal
      mstore(add(sportsData, 32), and(shr(240, memData), 0xFF))

      // Store the next 16 bits of memData at slot 2 of sportsData for homeScore
      mstore(add(sportsData, 64), and(shr(224, memData), 0xFFFF))

      // Store the next 16 bits of memData at slot 3 of sportsData for awayScore
      mstore(add(sportsData, 96), and(shr(208, memData), 0xFFFF))

      // Decode string for homeTeamName
      shift := add(shift, 42)
      {
        let homeTeamName_4 := mload(0x40)
        let homeTeamName_4_size := and(shr(176, memData), 0xFFFFFFFF)
        mstore(add(sportsData, 128), homeTeamName_4)
        // take a mod of 32 to update the free memory pointer
        mstore(
          0x40,
          add(
            homeTeamName_4,
            and(
              add(homeTeamName_4_size, 64),
              0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFe0
            )
          )
        )
        mstore(homeTeamName_4, homeTeamName_4_size)

        let homeTeamName_4_j := 32
        for {

        } lt(homeTeamName_4_j, homeTeamName_4_size) {
          homeTeamName_4_j := add(homeTeamName_4_j, 32)
          shift := add(shift, 32)
        } {
          memData := mload(add(data, shift))
          mstore(add(homeTeamName_4, homeTeamName_4_j), memData)
        }
        memData := mload(add(data, shift))
        mstore(add(homeTeamName_4, homeTeamName_4_j), memData)
        homeTeamName_4_j := mod(homeTeamName_4_size, 32)
        if iszero(homeTeamName_4_j) {
          homeTeamName_4_j := 32
        }

        shift := add(shift, homeTeamName_4_j)
        memData := mload(add(data, shift))
      }

      // Decode string for awayTeamName
      shift := add(shift, 4)
      {
        let awayTeamName_5 := mload(0x40)
        let awayTeamName_5_size := and(shr(224, memData), 0xFFFFFFFF)
        mstore(add(sportsData, 160), awayTeamName_5)
        // take a mod of 32 to update the free memory pointer
        mstore(
          0x40,
          add(
            awayTeamName_5,
            and(
              add(awayTeamName_5_size, 64),
              0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFe0
            )
          )
        )
        mstore(awayTeamName_5, awayTeamName_5_size)

        let awayTeamName_5_j := 32
        for {

        } lt(awayTeamName_5_j, awayTeamName_5_size) {
          awayTeamName_5_j := add(awayTeamName_5_j, 32)
          shift := add(shift, 32)
        } {
          memData := mload(add(data, shift))
          mstore(add(awayTeamName_5, awayTeamName_5_j), memData)
        }
        memData := mload(add(data, shift))
        mstore(add(awayTeamName_5, awayTeamName_5_j), memData)
        awayTeamName_5_j := mod(awayTeamName_5_size, 32)
        if iszero(awayTeamName_5_j) {
          awayTeamName_5_j := 32
        }

        shift := add(shift, awayTeamName_5_j)
        memData := mload(add(data, shift))
      }

      {
        // Get address of field at slot 6 of sportsData
        let sportsData_6 := mload(add(sportsData, 192))

        // Decode string for homePlayers
        shift := add(shift, 4)
        {
          let homePlayers_0 := mload(0x40)
          let homePlayers_0_size := and(shr(224, memData), 0xFFFFFFFF)
          mstore(sportsData_6, homePlayers_0)
          // take a mod of 32 to update the free memory pointer
          mstore(
            0x40,
            add(
              homePlayers_0,
              and(
                add(homePlayers_0_size, 64),
                0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFe0
              )
            )
          )
          mstore(homePlayers_0, homePlayers_0_size)

          let homePlayers_0_j := 32
          for {

          } lt(homePlayers_0_j, homePlayers_0_size) {
            homePlayers_0_j := add(homePlayers_0_j, 32)
            shift := add(shift, 32)
          } {
            memData := mload(add(data, shift))
            mstore(add(homePlayers_0, homePlayers_0_j), memData)
          }
          memData := mload(add(data, shift))
          mstore(add(homePlayers_0, homePlayers_0_j), memData)
          homePlayers_0_j := mod(homePlayers_0_size, 32)
          if iszero(homePlayers_0_j) {
            homePlayers_0_j := 32
          }

          shift := add(shift, homePlayers_0_j)
          memData := mload(add(data, shift))
        }

        // Decode string for homePlayers
        shift := add(shift, 4)
        {
          let homePlayers_1 := mload(0x40)
          let homePlayers_1_size := and(shr(224, memData), 0xFFFFFFFF)
          mstore(add(sportsData_6, 32), homePlayers_1)
          // take a mod of 32 to update the free memory pointer
          mstore(
            0x40,
            add(
              homePlayers_1,
              and(
                add(homePlayers_1_size, 64),
                0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFe0
              )
            )
          )
          mstore(homePlayers_1, homePlayers_1_size)

          let homePlayers_1_j := 32
          for {

          } lt(homePlayers_1_j, homePlayers_1_size) {
            homePlayers_1_j := add(homePlayers_1_j, 32)
            shift := add(shift, 32)
          } {
            memData := mload(add(data, shift))
            mstore(add(homePlayers_1, homePlayers_1_j), memData)
          }
          memData := mload(add(data, shift))
          mstore(add(homePlayers_1, homePlayers_1_j), memData)
          homePlayers_1_j := mod(homePlayers_1_size, 32)
          if iszero(homePlayers_1_j) {
            homePlayers_1_j := 32
          }

          shift := add(shift, homePlayers_1_j)
          memData := mload(add(data, shift))
        }

        // Decode string for homePlayers
        shift := add(shift, 4)
        {
          let homePlayers_2 := mload(0x40)
          let homePlayers_2_size := and(shr(224, memData), 0xFFFFFFFF)
          mstore(add(sportsData_6, 64), homePlayers_2)
          // take a mod of 32 to update the free memory pointer
          mstore(
            0x40,
            add(
              homePlayers_2,
              and(
                add(homePlayers_2_size, 64),
                0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFe0
              )
            )
          )
          mstore(homePlayers_2, homePlayers_2_size)

          let homePlayers_2_j := 32
          for {

          } lt(homePlayers_2_j, homePlayers_2_size) {
            homePlayers_2_j := add(homePlayers_2_j, 32)
            shift := add(shift, 32)
          } {
            memData := mload(add(data, shift))
            mstore(add(homePlayers_2, homePlayers_2_j), memData)
          }
          memData := mload(add(data, shift))
          mstore(add(homePlayers_2, homePlayers_2_j), memData)
          homePlayers_2_j := mod(homePlayers_2_size, 32)
          if iszero(homePlayers_2_j) {
            homePlayers_2_j := 32
          }

          shift := add(shift, homePlayers_2_j)
          memData := mload(add(data, shift))
        }

        // Decode string for homePlayers
        shift := add(shift, 4)
        {
          let homePlayers_3 := mload(0x40)
          let homePlayers_3_size := and(shr(224, memData), 0xFFFFFFFF)
          mstore(add(sportsData_6, 96), homePlayers_3)
          // take a mod of 32 to update the free memory pointer
          mstore(
            0x40,
            add(
              homePlayers_3,
              and(
                add(homePlayers_3_size, 64),
                0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFe0
              )
            )
          )
          mstore(homePlayers_3, homePlayers_3_size)

          let homePlayers_3_j := 32
          for {

          } lt(homePlayers_3_j, homePlayers_3_size) {
            homePlayers_3_j := add(homePlayers_3_j, 32)
            shift := add(shift, 32)
          } {
            memData := mload(add(data, shift))
            mstore(add(homePlayers_3, homePlayers_3_j), memData)
          }
          memData := mload(add(data, shift))
          mstore(add(homePlayers_3, homePlayers_3_j), memData)
          homePlayers_3_j := mod(homePlayers_3_size, 32)
          if iszero(homePlayers_3_j) {
            homePlayers_3_j := 32
          }

          shift := add(shift, homePlayers_3_j)
          memData := mload(add(data, shift))
        }

        // Decode string for homePlayers
        shift := add(shift, 4)
        {
          let homePlayers_4 := mload(0x40)
          let homePlayers_4_size := and(shr(224, memData), 0xFFFFFFFF)
          mstore(add(sportsData_6, 128), homePlayers_4)
          // take a mod of 32 to update the free memory pointer
          mstore(
            0x40,
            add(
              homePlayers_4,
              and(
                add(homePlayers_4_size, 64),
                0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFe0
              )
            )
          )
          mstore(homePlayers_4, homePlayers_4_size)

          let homePlayers_4_j := 32
          for {

          } lt(homePlayers_4_j, homePlayers_4_size) {
            homePlayers_4_j := add(homePlayers_4_j, 32)
            shift := add(shift, 32)
          } {
            memData := mload(add(data, shift))
            mstore(add(homePlayers_4, homePlayers_4_j), memData)
          }
          memData := mload(add(data, shift))
          mstore(add(homePlayers_4, homePlayers_4_j), memData)
          homePlayers_4_j := mod(homePlayers_4_size, 32)
          if iszero(homePlayers_4_j) {
            homePlayers_4_j := 32
          }

          shift := add(shift, homePlayers_4_j)
          memData := mload(add(data, shift))
        }

        // Decode string for homePlayers
        shift := add(shift, 4)
        {
          let homePlayers_5 := mload(0x40)
          let homePlayers_5_size := and(shr(224, memData), 0xFFFFFFFF)
          mstore(add(sportsData_6, 160), homePlayers_5)
          // take a mod of 32 to update the free memory pointer
          mstore(
            0x40,
            add(
              homePlayers_5,
              and(
                add(homePlayers_5_size, 64),
                0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFe0
              )
            )
          )
          mstore(homePlayers_5, homePlayers_5_size)

          let homePlayers_5_j := 32
          for {

          } lt(homePlayers_5_j, homePlayers_5_size) {
            homePlayers_5_j := add(homePlayers_5_j, 32)
            shift := add(shift, 32)
          } {
            memData := mload(add(data, shift))
            mstore(add(homePlayers_5, homePlayers_5_j), memData)
          }
          memData := mload(add(data, shift))
          mstore(add(homePlayers_5, homePlayers_5_j), memData)
          homePlayers_5_j := mod(homePlayers_5_size, 32)
          if iszero(homePlayers_5_j) {
            homePlayers_5_j := 32
          }

          shift := add(shift, homePlayers_5_j)
          memData := mload(add(data, shift))
        }
      }

      {
        // Get address of field at slot 7 of sportsData
        let sportsData_7 := mload(add(sportsData, 224))

        // Decode string for awayPlayers
        shift := add(shift, 4)
        {
          let awayPlayers_0 := mload(0x40)
          let awayPlayers_0_size := and(shr(224, memData), 0xFFFFFFFF)
          mstore(sportsData_7, awayPlayers_0)
          // take a mod of 32 to update the free memory pointer
          mstore(
            0x40,
            add(
              awayPlayers_0,
              and(
                add(awayPlayers_0_size, 64),
                0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFe0
              )
            )
          )
          mstore(awayPlayers_0, awayPlayers_0_size)

          let awayPlayers_0_j := 32
          for {

          } lt(awayPlayers_0_j, awayPlayers_0_size) {
            awayPlayers_0_j := add(awayPlayers_0_j, 32)
            shift := add(shift, 32)
          } {
            memData := mload(add(data, shift))
            mstore(add(awayPlayers_0, awayPlayers_0_j), memData)
          }
          memData := mload(add(data, shift))
          mstore(add(awayPlayers_0, awayPlayers_0_j), memData)
          awayPlayers_0_j := mod(awayPlayers_0_size, 32)
          if iszero(awayPlayers_0_j) {
            awayPlayers_0_j := 32
          }

          shift := add(shift, awayPlayers_0_j)
          memData := mload(add(data, shift))
        }

        // Decode string for awayPlayers
        shift := add(shift, 4)
        {
          let awayPlayers_1 := mload(0x40)
          let awayPlayers_1_size := and(shr(224, memData), 0xFFFFFFFF)
          mstore(add(sportsData_7, 32), awayPlayers_1)
          // take a mod of 32 to update the free memory pointer
          mstore(
            0x40,
            add(
              awayPlayers_1,
              and(
                add(awayPlayers_1_size, 64),
                0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFe0
              )
            )
          )
          mstore(awayPlayers_1, awayPlayers_1_size)

          let awayPlayers_1_j := 32
          for {

          } lt(awayPlayers_1_j, awayPlayers_1_size) {
            awayPlayers_1_j := add(awayPlayers_1_j, 32)
            shift := add(shift, 32)
          } {
            memData := mload(add(data, shift))
            mstore(add(awayPlayers_1, awayPlayers_1_j), memData)
          }
          memData := mload(add(data, shift))
          mstore(add(awayPlayers_1, awayPlayers_1_j), memData)
          awayPlayers_1_j := mod(awayPlayers_1_size, 32)
          if iszero(awayPlayers_1_j) {
            awayPlayers_1_j := 32
          }

          shift := add(shift, awayPlayers_1_j)
          memData := mload(add(data, shift))
        }

        // Decode string for awayPlayers
        shift := add(shift, 4)
        {
          let awayPlayers_2 := mload(0x40)
          let awayPlayers_2_size := and(shr(224, memData), 0xFFFFFFFF)
          mstore(add(sportsData_7, 64), awayPlayers_2)
          // take a mod of 32 to update the free memory pointer
          mstore(
            0x40,
            add(
              awayPlayers_2,
              and(
                add(awayPlayers_2_size, 64),
                0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFe0
              )
            )
          )
          mstore(awayPlayers_2, awayPlayers_2_size)

          let awayPlayers_2_j := 32
          for {

          } lt(awayPlayers_2_j, awayPlayers_2_size) {
            awayPlayers_2_j := add(awayPlayers_2_j, 32)
            shift := add(shift, 32)
          } {
            memData := mload(add(data, shift))
            mstore(add(awayPlayers_2, awayPlayers_2_j), memData)
          }
          memData := mload(add(data, shift))
          mstore(add(awayPlayers_2, awayPlayers_2_j), memData)
          awayPlayers_2_j := mod(awayPlayers_2_size, 32)
          if iszero(awayPlayers_2_j) {
            awayPlayers_2_j := 32
          }

          shift := add(shift, awayPlayers_2_j)
          memData := mload(add(data, shift))
        }

        // Decode string for awayPlayers
        shift := add(shift, 4)
        {
          let awayPlayers_3 := mload(0x40)
          let awayPlayers_3_size := and(shr(224, memData), 0xFFFFFFFF)
          mstore(add(sportsData_7, 96), awayPlayers_3)
          // take a mod of 32 to update the free memory pointer
          mstore(
            0x40,
            add(
              awayPlayers_3,
              and(
                add(awayPlayers_3_size, 64),
                0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFe0
              )
            )
          )
          mstore(awayPlayers_3, awayPlayers_3_size)

          let awayPlayers_3_j := 32
          for {

          } lt(awayPlayers_3_j, awayPlayers_3_size) {
            awayPlayers_3_j := add(awayPlayers_3_j, 32)
            shift := add(shift, 32)
          } {
            memData := mload(add(data, shift))
            mstore(add(awayPlayers_3, awayPlayers_3_j), memData)
          }
          memData := mload(add(data, shift))
          mstore(add(awayPlayers_3, awayPlayers_3_j), memData)
          awayPlayers_3_j := mod(awayPlayers_3_size, 32)
          if iszero(awayPlayers_3_j) {
            awayPlayers_3_j := 32
          }

          shift := add(shift, awayPlayers_3_j)
          memData := mload(add(data, shift))
        }

        // Decode string for awayPlayers
        shift := add(shift, 4)
        {
          let awayPlayers_4 := mload(0x40)
          let awayPlayers_4_size := and(shr(224, memData), 0xFFFFFFFF)
          mstore(add(sportsData_7, 128), awayPlayers_4)
          // take a mod of 32 to update the free memory pointer
          mstore(
            0x40,
            add(
              awayPlayers_4,
              and(
                add(awayPlayers_4_size, 64),
                0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFe0
              )
            )
          )
          mstore(awayPlayers_4, awayPlayers_4_size)

          let awayPlayers_4_j := 32
          for {

          } lt(awayPlayers_4_j, awayPlayers_4_size) {
            awayPlayers_4_j := add(awayPlayers_4_j, 32)
            shift := add(shift, 32)
          } {
            memData := mload(add(data, shift))
            mstore(add(awayPlayers_4, awayPlayers_4_j), memData)
          }
          memData := mload(add(data, shift))
          mstore(add(awayPlayers_4, awayPlayers_4_j), memData)
          awayPlayers_4_j := mod(awayPlayers_4_size, 32)
          if iszero(awayPlayers_4_j) {
            awayPlayers_4_j := 32
          }

          shift := add(shift, awayPlayers_4_j)
          memData := mload(add(data, shift))
        }

        // Decode string for awayPlayers
        shift := add(shift, 4)
        {
          let awayPlayers_5 := mload(0x40)
          let awayPlayers_5_size := and(shr(224, memData), 0xFFFFFFFF)
          mstore(add(sportsData_7, 160), awayPlayers_5)
          // take a mod of 32 to update the free memory pointer
          mstore(
            0x40,
            add(
              awayPlayers_5,
              and(
                add(awayPlayers_5_size, 64),
                0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFe0
              )
            )
          )
          mstore(awayPlayers_5, awayPlayers_5_size)

          let awayPlayers_5_j := 32
          for {

          } lt(awayPlayers_5_j, awayPlayers_5_size) {
            awayPlayers_5_j := add(awayPlayers_5_j, 32)
            shift := add(shift, 32)
          } {
            memData := mload(add(data, shift))
            mstore(add(awayPlayers_5, awayPlayers_5_j), memData)
          }
          memData := mload(add(data, shift))
          mstore(add(awayPlayers_5, awayPlayers_5_j), memData)
          awayPlayers_5_j := mod(awayPlayers_5_size, 32)
          if iszero(awayPlayers_5_j) {
            awayPlayers_5_j := 32
          }

          shift := add(shift, awayPlayers_5_j)
          memData := mload(add(data, shift))
        }
      }
    }
  }
}
