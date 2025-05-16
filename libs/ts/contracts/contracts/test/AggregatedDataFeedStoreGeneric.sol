// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract AggregatedDataFeedStoreGeneric {
  address internal constant DATA_FEED_ADDRESS =
    0x0000000100000000000000000000000000000000;
  address internal constant RING_BUFFER_TABLE_ADDRESS =
    0x0000000000000000000000000000000000001000;
  address internal immutable ACCESS_CONTROL;

  event DataFeedsUpdated(uint256 blocknumber);

  uint256 internal blocknumber;

  constructor(address accessControl) {
    ACCESS_CONTROL = accessControl;
  }

  function getLatestIndex(
    uint256 stride,
    uint256 feedId
  ) public view returns (uint256 index) {
    uint256 indexSlot = uint160(RING_BUFFER_TABLE_ADDRESS) +
      (2 ** 115 * stride + feedId) /
      16;
    uint256 pos = (feedId % 16) * 16;

    assembly {
      index := shr(
        sub(240, pos),
        and(
          sload(indexSlot),
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
    uint256 startSlot,
    uint256 slots
  ) public view returns (bytes memory) {
    return
      _getData(
        getLatestIndex(stride, feedId),
        stride,
        feedId,
        startSlot,
        slots
      );
  }

  function getDataAtIndex(
    uint256 stride,
    uint256 feedId,
    uint256 index,
    uint256 startSlot,
    uint256 slots
  ) public view returns (bytes memory) {
    return _getData(index, stride, feedId, startSlot, slots);
  }

  function getLatestDataAndIndex(
    uint256 stride,
    uint256 feedId,
    uint256 startSlot,
    uint256 slots
  ) external view returns (uint256, bytes memory) {
    uint256 index = getLatestIndex(stride, feedId);
    return (index, getDataAtIndex(stride, feedId, index, startSlot, slots));
  }

  function _getData(
    uint256 index,
    uint256 stride,
    uint256 feedId,
    uint256 startSlot,
    uint256 slots
  ) internal view returns (bytes memory data) {
    uint256 pos = startSlot +
      (uint256(uint160(DATA_FEED_ADDRESS)) << stride) +
      (feedId * (2 ** 13) + index) *
      (2 ** stride);

    assembly {
      data := mload(0x40)
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
      mstore(0x40, add(data, j))
    }
  }

  function write(
    uint256 blocknumber_,
    uint256[] calldata strides,
    uint256[] calldata indices,
    bytes[] calldata data,
    uint256[] calldata indexTableIndices,
    bytes32[] calldata indexTableData
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
        assembly {
          sstore(add(shl(stride, DATA_FEED_ADDRESS), add(index, j)), dataSlice)
        }
      }
    }

    for (uint256 i = 0; i < indexTableIndices.length; i++) {
      uint256 index = indexTableIndices[i];

      require(index < 2 ** 116);

      bytes32 dataSlice = indexTableData[i];
      assembly {
        sstore(add(RING_BUFFER_TABLE_ADDRESS, index), dataSlice)
      }
    }

    emit DataFeedsUpdated(blocknumber_);
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
