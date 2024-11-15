// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import '../libraries/ProxyCall.sol';
import '../interfaces/morpho/IOracle.sol';

contract BlocksenseMorphoOracle is IOracle {
  address internal immutable BLOCKSENSE_ORACLE;
  uint32 internal immutable KEY;
  uint32 internal immutable DECIMALS;

  constructor(address blocksenseOracle_, uint32 key_, uint32 decimals_) {
    BLOCKSENSE_ORACLE = blocksenseOracle_;
    KEY = key_;
    DECIMALS = decimals_;
  }

  function price() external view override returns (uint256) {
    return
      uint256(
        uint192(
          bytes24(
            ProxyCall._callDataFeed(
              BLOCKSENSE_ORACLE,
              abi.encodePacked(0x80000000 | KEY)
            )
          )
        ) * 10 ** (24 - DECIMALS)
      );
  }
}
