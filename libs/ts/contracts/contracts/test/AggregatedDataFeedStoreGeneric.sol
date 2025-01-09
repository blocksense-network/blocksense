// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract AggregatedDataFeedStoreGeneric {
  address internal constant DATA_FEED_ADDRESS =
    0x0000000100000000000000000000000000000000;
  address internal constant ROUND_ADDRESS =
    0x0000000000000000000000000000000000001000;
  address internal immutable ACCESS_CONTROL;

  uint256 internal blocknumber;

  constructor(address accessControl) {
    ACCESS_CONTROL = accessControl;
  }

  function getLatestRound(
    uint256 stride,
    uint256 feedId
  ) public view returns (uint256 round) {
    uint256 index = uint160(ROUND_ADDRESS) + (2 ** 115 * stride + feedId) / 16;
    uint256 pos = (feedId % 16) * 16;

    assembly {
      round := shr(
        sub(240, pos),
        and(
          sload(index),
          shr(
            pos,
            0xFFFF000000000000000000000000000000000000000000000000000000000000
          )
        )
      )
    }
  }

  function getLatestData(
    uint256 stride,
    uint256 feedId,
    uint256 slots
  ) public view returns (bytes memory) {
    return _getData(getLatestRound(stride, feedId), stride, feedId, slots);
  }

  function getFeedAtRound(
    uint256 stride,
    uint256 feedId,
    uint256 round,
    uint256 slots
  ) public view returns (bytes memory) {
    return _getData(round, stride, feedId, slots);
  }

  function getLatestDataAndRound(
    uint256 stride,
    uint256 feedId,
    uint256 slots
  ) external view returns (uint256, bytes memory) {
    uint256 round = getLatestRound(stride, feedId);
    return (round, getFeedAtRound(stride, feedId, round, slots));
  }

  function _getData(
    uint256 round,
    uint256 stride,
    uint256 feedId,
    uint256 slots
  ) internal view returns (bytes memory data) {
    uint256 pos = (uint256(uint160(DATA_FEED_ADDRESS)) << stride) +
      (feedId * 2 ** 13 + round) *
      (stride + 1);

    assembly {
      let ptr := mload(0x40)
      data := mload(ptr)
      let j := 32
      for {
        let i := 0
      } lt(i, slots) {
        i := add(i, 1)
        j := add(j, 32)
      } {
        let feedData := sload(add(pos, i))
        mstore(add(data, j), feedData)
      }

      mstore(data, mul(slots, 32))
      mstore(0x40, add(ptr, j))
    }
  }

  function write(
    uint256 blocknumber_,
    uint256[] calldata strides,
    uint256[] calldata indices,
    bytes[] calldata data,
    uint256[] calldata roundTableIndices,
    bytes32[] calldata roundTableData
  ) external {
    (bool success, bytes memory res) = ACCESS_CONTROL.call(
      abi.encodePacked(msg.sender)
    );
    bool isAdmin = abi.decode(res, (bool));
    require(success && isAdmin);

    require(blocknumber < blocknumber_);
    blocknumber = blocknumber_;

    for (uint256 i = 0; i < indices.length; i++) {
      uint256 index = indices[i];
      uint256 stride = strides[i];

      require(stride < 32);

      bytes32[] memory data_ = _bytesToBytes32Array(data[i]);
      uint256 length = data_.length;
      for (uint256 j = 0; j < length; j++) {
        bytes32 dataSlice = data_[j];
        bytes32 test;
        assembly {
          sstore(add(shl(stride, DATA_FEED_ADDRESS), add(index, j)), dataSlice)
          test := add(shl(stride, DATA_FEED_ADDRESS), add(index, j))
        }
      }
    }

    for (uint256 i = 0; i < roundTableIndices.length; i++) {
      uint256 index = roundTableIndices[i];

      require(index < 2 ** 115);

      bytes32 dataSlice = roundTableData[i];
      assembly {
        sstore(add(ROUND_ADDRESS, index), dataSlice)
      }
    }
  }

  function _bytesToBytes32Array(
    bytes memory data
  ) internal pure returns (bytes32[] memory) {
    uint256 dataNb = data.length / 32 + 1;
    bytes32[] memory dataList = new bytes32[](dataNb);

    uint256 index;
    for (uint256 i = 0; i <= data.length; i += 32) {
      bytes32 temp;
      assembly {
        temp := mload(add(data, add(i, 32)))
      }

      dataList[index] = temp;
      index++;
    }

    return (dataList);
  }
}
