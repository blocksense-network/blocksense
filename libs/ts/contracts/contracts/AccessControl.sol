// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract AccessControl {
  address internal immutable owner;
  bytes32 internal constant ADMIN_LOCATION =
    0x0000000000000000000000000000000000000000000000000000abc123abc123;

  constructor(address owner_) {
    owner = owner_;
  }

  fallback() external {
    address _owner = owner;

    assembly {
      let selector := calldataload(0x00)

      // function checkAdminRole(address _caller) external view returns (bool) {
      if eq(shr(224, selector), 0xe386be2e) {
        let _caller := shl(32, selector)
        mstore(0, or(ADMIN_LOCATION, _caller))

        let location := keccak256(0, 0x20)

        mstore(0, sload(location))
        return(0, 0x20)
      }

      // function setAdmins(address[] calldata addresses) external {
      if eq(shr(224, selector), 0xaccc1d5e) {
        if iszero(eq(caller(), _owner)) {
          revert(0, 0)
        }

        let length := calldatasize()
        for {
          let pointer := 4
        } lt(pointer, length) {
          pointer := add(pointer, 20)
        } {
          let admin := and(
            calldataload(pointer),
            0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF000000000000000000000000
          )

          mstore(0, or(ADMIN_LOCATION, admin))
          let location := keccak256(0, 0x20)

          sstore(location, 1)
        }

        return(0, 0)
      }

      revert(0, 0)
    }
  }
}
