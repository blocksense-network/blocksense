// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Proxy} from '@openzeppelin/contracts/proxy/Proxy.sol';
import {ITransparentUpgradeableProxy} from '@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol';

/// @title UpgradeableProxy
/// @notice Transaprent proxy contract that allows the implementation to be upgraded
/// @dev This contract is based on the OpenZeppelin UpgradeableProxy contract
contract UpgradeableProxy is Proxy {
  /// @notice Slot for the implementation address
  /// @dev The slot is high enough to prevent storage collisions
  /// This is the keccak-256 hash of "eip1967.proxy.implementation" subtracted by 1.
  bytes32 internal constant IMPLEMENTATION_SLOT =
    0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

  /// @notice Admin of the contract
  address private immutable _admin;

  event Upgraded(address indexed implementation);

  error ProxyDeniedAdminAccess();
  error InvalidImplementation(address implementation);

  /// @notice Construct the UpgradeableProxy contract
  /// @param _logic The address of the initial implementation
  /// @param _owner The address of the admin
  constructor(address _logic, address _owner) {
    _admin = _owner;
    _upgradeTo(_logic);
  }

  /// @notice Get the current implementation
  /// @return impl The address of the current implementation
  function _implementation() internal view override returns (address impl) {
    assembly {
      impl := sload(IMPLEMENTATION_SLOT)
    }
  }

  /// @notice Fallback function
  /// @dev The fallback function is used to delegate calls to the implementation contract
  /// If the sender is the admin, the function will dispatch the upgrade to a new implementation
  /// The admin can only call this contract to upgrade the implementation
  function _fallback() internal override {
    if (msg.sender == _admin) {
      if (msg.sig != ITransparentUpgradeableProxy.upgradeToAndCall.selector) {
        revert ProxyDeniedAdminAccess();
      } else {
        _dispatchUpgradeTo();
      }
    } else {
      super._fallback();
    }
  }

  /// @notice Dispatch the upgrade to a new implementation
  /// @dev Extracts the new implementation address from the calldata
  function _dispatchUpgradeTo() internal {
    address newImplementation = address(bytes20(msg.data[4:]));
    _upgradeTo(newImplementation);
  }

  /// @notice Upgrade the implementation to a new implementation
  /// @param newImplementation The address of the new implementation
  function _upgradeTo(address newImplementation) internal {
    if (newImplementation.code.length == 0) {
      revert InvalidImplementation(newImplementation);
    }

    assembly {
      sstore(IMPLEMENTATION_SLOT, newImplementation)
    }
    emit Upgraded(newImplementation);
  }
}
