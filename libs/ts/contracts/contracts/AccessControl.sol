// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract AccessControl {
  address internal immutable OWNER;
  bytes32 internal constant ADMIN_LOCATION =
    0x0000000000000000000000000000000000000000000000000000abc123abc123;

  constructor(address owner_) {
    OWNER = owner_;
  }

  fallback() external {
    address _owner = OWNER;

    // no selector is passed
    // whether read or write operation will be executed is determined by the caller
    assembly {
      let _caller := caller()

      // function setAdmins(address[] calldata addresses) external {
      if eq(_caller, _owner) {
        let length := calldatasize()
        for {
          let pointer := 0
        } lt(pointer, length) {
          pointer := add(pointer, 20)
        } {
          let admin := and(
            calldataload(pointer),
            0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF000000000000000000000000
          )

          mstore(0, or(ADMIN_LOCATION, admin))

          sstore(keccak256(0, 0x20), 1)
        }

        return(0, 0)
      }

      // function checkAdminRole(address caller) external view returns (bool) {
      mstore(0, or(ADMIN_LOCATION, calldataload(0)))
      mstore(0, sload(keccak256(0, 0x20)))
      return(0, 0x20)
    }
  }
}
