// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Decoder for stored packed tuple data
library SportsSSZDecoderLib {
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
      let data_length := shr(240, mload(add(data, 32)))

      // Get offset
      let sportsData_var_offset_0 := and(
        shr(224, mload(add(data, 40))),
        0xFFFFFFFF
      )

      // Convert sportsData_var_offset_0 to big endian
      {
        sportsData_var_offset_0 := or(
          or(
            and(shr(24, sportsData_var_offset_0), 0xFF),
            and(shr(8, sportsData_var_offset_0), 0xFF00)
          ),
          or(
            and(shl(8, sportsData_var_offset_0), 0xFF0000),
            and(shl(24, sportsData_var_offset_0), 0xFF000000)
          )
        )
      }

      // Get offset
      let sportsData_var_offset_1 := and(
        shr(224, mload(add(data, 44))),
        0xFFFFFFFF
      )

      // Convert sportsData_var_offset_1 to big endian
      {
        sportsData_var_offset_1 := or(
          or(
            and(shr(24, sportsData_var_offset_1), 0xFF),
            and(shr(8, sportsData_var_offset_1), 0xFF00)
          ),
          or(
            and(shl(8, sportsData_var_offset_1), 0xFF0000),
            and(shl(24, sportsData_var_offset_1), 0xFF000000)
          )
        )
      }

      // Get offset
      let sportsData_var_offset_2 := and(
        shr(224, mload(add(data, 48))),
        0xFFFFFFFF
      )

      // Convert sportsData_var_offset_2 to big endian
      {
        sportsData_var_offset_2 := or(
          or(
            and(shr(24, sportsData_var_offset_2), 0xFF),
            and(shr(8, sportsData_var_offset_2), 0xFF00)
          ),
          or(
            and(shl(8, sportsData_var_offset_2), 0xFF0000),
            and(shl(24, sportsData_var_offset_2), 0xFF000000)
          )
        )
      }

      // Get offset
      let sportsData_var_offset_3 := and(
        shr(224, mload(add(data, 52))),
        0xFFFFFFFF
      )

      // Convert sportsData_var_offset_3 to big endian
      {
        sportsData_var_offset_3 := or(
          or(
            and(shr(24, sportsData_var_offset_3), 0xFF),
            and(shr(8, sportsData_var_offset_3), 0xFF00)
          ),
          or(
            and(shl(8, sportsData_var_offset_3), 0xFF0000),
            and(shl(24, sportsData_var_offset_3), 0xFF000000)
          )
        )
      }

      // Container variable length for sportsData
      {
        // Store 8 bits of data at slot 0 of sportsData for isOvertime
        mstore(sportsData, shr(248, mload(add(data, 34))))

        // Store 8 bits of data at slot 1 of sportsData for isFinal
        mstore(add(sportsData, 32), shr(248, mload(add(data, 35))))

        // Store 16 bits of data at slot 2 of sportsData for homeScore
        mstore(add(sportsData, 64), shr(240, mload(add(data, 36))))

        // Store 16 bits of data at slot 3 of sportsData for awayScore
        mstore(add(sportsData, 96), shr(240, mload(add(data, 38))))

        sportsData_var_offset_0 := add(sportsData_var_offset_0, 34)
        sportsData_var_offset_1 := add(sportsData_var_offset_1, 34)

        // String/Bytes for homeTeamName
        {
          let homeTeamName_size := sub(
            sportsData_var_offset_1,
            sportsData_var_offset_0
          )
          let homeTeamName := mload(0x40)
          mstore(add(sportsData, 128), homeTeamName)

          // take a mod of 32 to update the free memory pointer
          mstore(
            0x40,
            add(
              homeTeamName,
              and(
                add(homeTeamName_size, 64),
                0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFe0
              )
            )
          )
          mstore(homeTeamName, homeTeamName_size)

          let homeTeamName_i := 32
          for {

          } lt(homeTeamName_i, homeTeamName_size) {
            homeTeamName_i := add(homeTeamName_i, 32)
          } {
            mstore(
              add(homeTeamName, homeTeamName_i),
              mload(
                add(data, add(sportsData_var_offset_0, sub(homeTeamName_i, 32)))
              )
            )
          }
          mstore(
            add(homeTeamName, homeTeamName_i),
            mload(
              add(data, add(sportsData_var_offset_0, sub(homeTeamName_i, 32)))
            )
          )
        }

        sportsData_var_offset_2 := add(sportsData_var_offset_2, 34)

        // String/Bytes for awayTeamName
        {
          let awayTeamName_size := sub(
            sportsData_var_offset_2,
            sportsData_var_offset_1
          )
          let awayTeamName := mload(0x40)
          mstore(add(sportsData, 160), awayTeamName)

          // take a mod of 32 to update the free memory pointer
          mstore(
            0x40,
            add(
              awayTeamName,
              and(
                add(awayTeamName_size, 64),
                0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFe0
              )
            )
          )
          mstore(awayTeamName, awayTeamName_size)

          let awayTeamName_i := 32
          for {

          } lt(awayTeamName_i, awayTeamName_size) {
            awayTeamName_i := add(awayTeamName_i, 32)
          } {
            mstore(
              add(awayTeamName, awayTeamName_i),
              mload(
                add(data, add(sportsData_var_offset_1, sub(awayTeamName_i, 32)))
              )
            )
          }
          mstore(
            add(awayTeamName, awayTeamName_i),
            mload(
              add(data, add(sportsData_var_offset_1, sub(awayTeamName_i, 32)))
            )
          )
        }

        sportsData_var_offset_3 := add(sportsData_var_offset_3, 34)

        // Vector Composite for homePlayers
        {
          // Composite Array Variable Length for homePlayers
          {
            let sportsData_6_firstOffset := and(
              shr(224, mload(add(data, sportsData_var_offset_2))),
              0xFFFFFFFF
            )

            // Convert sportsData_6_firstOffset to big endian
            {
              sportsData_6_firstOffset := or(
                or(
                  and(shr(24, sportsData_6_firstOffset), 0xFF),
                  and(shr(8, sportsData_6_firstOffset), 0xFF00)
                ),
                or(
                  and(shl(8, sportsData_6_firstOffset), 0xFF0000),
                  and(shl(24, sportsData_6_firstOffset), 0xFF000000)
                )
              )
            }

            let sportsData_6_size := div(sportsData_6_firstOffset, 4)
            sportsData_6_firstOffset := add(
              sportsData_6_firstOffset,
              sportsData_var_offset_2
            )

            let sportsData_6 := mload(0x40)

            mstore(0x40, add(sportsData_6, mul(sportsData_6_size, 0x20)))
            mstore(add(sportsData, 192), sportsData_6)

            let sportsData_pos := mload(0x40)
            mstore(
              0x40,
              add(sportsData_pos, mul(add(sportsData_6_size, 1), 0x20))
            )

            // Store first array pos
            mstore(sportsData_pos, sportsData_6_firstOffset)
            for {
              let sportsData_6_i := 1
            } lt(sportsData_6_i, sportsData_6_size) {
              sportsData_6_i := add(sportsData_6_i, 1)
            } {
              let innerArrayPos := and(
                shr(
                  224,
                  mload(
                    add(
                      data,
                      add(sportsData_var_offset_2, mul(sportsData_6_i, 4))
                    )
                  )
                ),
                0xFFFFFFFF
              )

              // Convert innerArrayPos to big endian
              {
                innerArrayPos := or(
                  or(
                    and(shr(24, innerArrayPos), 0xFF),
                    and(shr(8, innerArrayPos), 0xFF00)
                  ),
                  or(
                    and(shl(8, innerArrayPos), 0xFF0000),
                    and(shl(24, innerArrayPos), 0xFF000000)
                  )
                )
              }

              innerArrayPos := add(innerArrayPos, sportsData_var_offset_2)

              mstore(
                add(sportsData_pos, mul(sportsData_6_i, 0x20)),
                innerArrayPos
              )
            }
            // Store end array pos
            mstore(
              add(sportsData_pos, mul(sportsData_6_size, 0x20)),
              sportsData_var_offset_3
            )

            for {
              let sportsData_6_i := 0
            } lt(sportsData_6_i, sportsData_6_size) {
              sportsData_6_i := add(sportsData_6_i, 1)
            } {
              let sportsData_6_start := mload(
                add(sportsData_pos, mul(sportsData_6_i, 0x20))
              )
              let sportsData_6_end := mload(
                add(sportsData_pos, mul(add(sportsData_6_i, 1), 0x20))
              )

              // String/Bytes for homePlayers
              {
                let homePlayers_size := sub(
                  sportsData_6_end,
                  sportsData_6_start
                )
                let homePlayers := mload(0x40)
                mstore(
                  add(sportsData_6, mul(sportsData_6_i, 0x20)),
                  homePlayers
                )

                // take a mod of 32 to update the free memory pointer
                mstore(
                  0x40,
                  add(
                    homePlayers,
                    and(
                      add(homePlayers_size, 64),
                      0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFe0
                    )
                  )
                )
                mstore(homePlayers, homePlayers_size)

                let homePlayers_i := 32
                for {

                } lt(homePlayers_i, homePlayers_size) {
                  homePlayers_i := add(homePlayers_i, 32)
                } {
                  mstore(
                    add(homePlayers, homePlayers_i),
                    mload(
                      add(data, add(sportsData_6_start, sub(homePlayers_i, 32)))
                    )
                  )
                }
                mstore(
                  add(homePlayers, homePlayers_i),
                  mload(
                    add(data, add(sportsData_6_start, sub(homePlayers_i, 32)))
                  )
                )
              }
            }
          }
        }

        // Vector Composite for awayPlayers
        {
          // Composite Array Variable Length for awayPlayers
          {
            let sportsData_7_firstOffset := and(
              shr(224, mload(add(data, sportsData_var_offset_3))),
              0xFFFFFFFF
            )

            // Convert sportsData_7_firstOffset to big endian
            {
              sportsData_7_firstOffset := or(
                or(
                  and(shr(24, sportsData_7_firstOffset), 0xFF),
                  and(shr(8, sportsData_7_firstOffset), 0xFF00)
                ),
                or(
                  and(shl(8, sportsData_7_firstOffset), 0xFF0000),
                  and(shl(24, sportsData_7_firstOffset), 0xFF000000)
                )
              )
            }

            let sportsData_7_size := div(sportsData_7_firstOffset, 4)
            sportsData_7_firstOffset := add(
              sportsData_7_firstOffset,
              sportsData_var_offset_3
            )

            let sportsData_7 := mload(0x40)

            mstore(0x40, add(sportsData_7, mul(sportsData_7_size, 0x20)))
            mstore(add(sportsData, 224), sportsData_7)

            let sportsData_pos := mload(0x40)
            mstore(
              0x40,
              add(sportsData_pos, mul(add(sportsData_7_size, 1), 0x20))
            )

            // Store first array pos
            mstore(sportsData_pos, sportsData_7_firstOffset)
            for {
              let sportsData_7_i := 1
            } lt(sportsData_7_i, sportsData_7_size) {
              sportsData_7_i := add(sportsData_7_i, 1)
            } {
              let innerArrayPos := and(
                shr(
                  224,
                  mload(
                    add(
                      data,
                      add(sportsData_var_offset_3, mul(sportsData_7_i, 4))
                    )
                  )
                ),
                0xFFFFFFFF
              )

              // Convert innerArrayPos to big endian
              {
                innerArrayPos := or(
                  or(
                    and(shr(24, innerArrayPos), 0xFF),
                    and(shr(8, innerArrayPos), 0xFF00)
                  ),
                  or(
                    and(shl(8, innerArrayPos), 0xFF0000),
                    and(shl(24, innerArrayPos), 0xFF000000)
                  )
                )
              }

              innerArrayPos := add(innerArrayPos, sportsData_var_offset_3)

              mstore(
                add(sportsData_pos, mul(sportsData_7_i, 0x20)),
                innerArrayPos
              )
            }
            // Store end array pos
            mstore(
              add(sportsData_pos, mul(sportsData_7_size, 0x20)),
              add(data_length, 32)
            )

            for {
              let sportsData_7_i := 0
            } lt(sportsData_7_i, sportsData_7_size) {
              sportsData_7_i := add(sportsData_7_i, 1)
            } {
              let sportsData_7_start := mload(
                add(sportsData_pos, mul(sportsData_7_i, 0x20))
              )
              let sportsData_7_end := mload(
                add(sportsData_pos, mul(add(sportsData_7_i, 1), 0x20))
              )

              // String/Bytes for awayPlayers
              {
                let awayPlayers_size := sub(
                  sportsData_7_end,
                  sportsData_7_start
                )
                let awayPlayers := mload(0x40)
                mstore(
                  add(sportsData_7, mul(sportsData_7_i, 0x20)),
                  awayPlayers
                )

                // take a mod of 32 to update the free memory pointer
                mstore(
                  0x40,
                  add(
                    awayPlayers,
                    and(
                      add(awayPlayers_size, 64),
                      0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFe0
                    )
                  )
                )
                mstore(awayPlayers, awayPlayers_size)

                let awayPlayers_i := 32
                for {

                } lt(awayPlayers_i, awayPlayers_size) {
                  awayPlayers_i := add(awayPlayers_i, 32)
                } {
                  mstore(
                    add(awayPlayers, awayPlayers_i),
                    mload(
                      add(data, add(sportsData_7_start, sub(awayPlayers_i, 32)))
                    )
                  )
                }
                mstore(
                  add(awayPlayers, awayPlayers_i),
                  mload(
                    add(data, add(sportsData_7_start, sub(awayPlayers_i, 32)))
                  )
                )
              }
            }
          }
        }
      }
    }
  }
}
