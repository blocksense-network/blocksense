// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AccessControl
/// @notice Contract that manages access control when writing to the dataFeedStore storage
contract AccessControl {
  address internal immutable OWNER;

  constructor(address owner_) {
    OWNER = owner_;
  }

  fallback() external {
    address _owner = OWNER;

    // no selector is passed
    // whether read or write operation will be executed is determined by the caller
    assembly {
      let _caller := caller()

      // function setAdmins(bytes) external {
      // bytes: <address1 (20b)><isAdmin1 (1b)>...<addressN><isAdminN>
      if eq(_caller, _owner) {
        let length := calldatasize()
        for {
          let pointer := 0
        } lt(pointer, length) {
          pointer := add(pointer, 21)
        } {
          let metadata := calldataload(pointer)
          let admin := and(
            metadata,
            0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF000000000000000000000000
          )
          let isAdmin := byte(20, metadata)

          sstore(admin, isAdmin)
        }

        return(0, 0)
      }

      // function checkAdminRole(address caller) external view returns (bool) {
      let admin := calldataload(0)
      mstore(0, sload(admin))
      return(0, 0x20)
    }
  }
}
