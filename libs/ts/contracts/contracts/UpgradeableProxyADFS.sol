// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IUpgradeableProxy} from './interfaces/IUpgradeableProxy.sol';

/// @title UpgradeableProxy
/// @notice Transaprent proxy contract that allows the implementation to be upgraded
/// @dev This contract is based on the OpenZeppelin UpgradeableProxy contract
contract UpgradeableProxyADFS {
  /// @notice Slot for the implementation address
  /// @dev The slot is high enough to prevent storage collisions
  /// This is the keccak-256 hash of "eip1967.proxy.implementation" subtracted by 1.
  bytes32 internal constant IMPLEMENTATION_SLOT =
    0x0000000000000000000000000000000000000000000000000000000000000001;

  /// @notice Admin of the contract
  bytes32 internal constant ADMIN_SLOT =
    0x0000000000000000000000000000000000000000000000000000000000000002;

  event Upgraded(address indexed implementation);
  event AdminSet(address indexed newAdmin);

  error ProxyDeniedAdminAccess();
  error InvalidUpgrade(address value);

  /// @notice Construct the UpgradeableProxy contract
  /// @param _logic The address of the initial implementation
  /// @param _owner The address of the admin
  constructor(address _logic, address _owner) {
    _setAdmin(_owner);
    _upgradeTo(_logic);
  }

  /// @notice Fallback function
  /// @dev The fallback function is used to delegate calls to the implementation contract
  /// If the sender is the admin, the function will dispatch the upgrade to a new implementation
  /// The admin can only call this contract to upgrade the implementation
  fallback() external payable {
    bool isAdmin;

    assembly {
      isAdmin := eq(caller(), sload(ADMIN_SLOT))
    }

    if (isAdmin) {
      if (msg.sig == IUpgradeableProxy.upgradeTo.selector) {
        _upgradeTo(address(bytes20(msg.data[4:])));
        return;
      } else if (msg.sig == IUpgradeableProxy.setAdmin.selector) {
        _setAdmin(address(bytes20(msg.data[4:])));
        return;
      }

      revert ProxyDeniedAdminAccess();
    }

    assembly {
      // Copy msg.data. We take full control of memory in this inline assembly
      // block because it will not return to Solidity code. We overwrite the
      // Solidity scratch pad at memory position 0.
      calldatacopy(0, 0, calldatasize())

      // Call the implementation.
      // out and outsize are 0 because we don't know the size yet.
      let result := delegatecall(
        gas(),
        sload(IMPLEMENTATION_SLOT),
        0,
        calldatasize(),
        0,
        0
      )

      // Copy the returned data.
      returndatacopy(0, 0, returndatasize())

      if iszero(result) {
        revert(0, returndatasize())
      }
      return(0, returndatasize())
    }
  }

  /// @notice Upgrade the implementation to a new implementation
  /// @param newImplementation The address of the new implementation
  function _upgradeTo(address newImplementation) internal {
    if (newImplementation.code.length == 0) {
      revert InvalidUpgrade(newImplementation);
    }

    assembly {
      sstore(IMPLEMENTATION_SLOT, newImplementation)
    }
    emit Upgraded(newImplementation);
  }

  function _setAdmin(address newAdmin) internal {
    if (newAdmin == address(0)) {
      revert InvalidUpgrade(newAdmin);
    }

    assembly {
      sstore(ADMIN_SLOT, newAdmin)
    }
    emit AdminSet(newAdmin);
  }
}
