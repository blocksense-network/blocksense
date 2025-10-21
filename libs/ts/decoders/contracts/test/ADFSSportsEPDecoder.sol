// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {SportsEPDecoderLib} from './libraries/SportsEPDecoderLib.sol';

contract ADFSSportsEPDecoder {
  address internal immutable adfsAddress;

  constructor(address _adfsAddress) {
    adfsAddress = _adfsAddress;
  }

  function getLatestData(
    uint256 feedId
  ) external view returns (SportsEPDecoderLib.SportsData memory) {
    uint256 selector = (uint256(0x84) << 248) | (feedId << 120);

    (bool success, bytes memory returnData) = adfsAddress.staticcall(
      abi.encodePacked(selector)
    );

    require(success, 'Call to ADFS failed');

    return SportsEPDecoderLib.decode(returnData);
  }
}
