// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: Copyright (c) 2024-2025 Schelling Point Labs Inc.
pragma solidity ^0.8.24;

//    ___  __         __                           _  __    __                  __
//   / _ )/ /__  ____/ /__ ___ ___ ___  ___ ___   / |/ /__ / /__    _____  ____/ /__
//  / _  / / _ \/ __/  '_/(_-</ -_) _ \(_-</ -_) /    / -_) __/ |/|/ / _ \/ __/  '_/
// /____/_/\___/\__/_/\_\/___/\__/_//_/___/\__/ /_/|_/\__/\__/|__,__/\___/_/ /_/\_\
//    _____   ____  ___    ___   ___  ________
//   / __/ | / /  |/  /   / _ | / _ \/ __/ __/
//  / _/ | |/ / /|_/ /   / __ |/ // / _/_\ \
// /___/ |___/_/  /_/   /_/ |_/____/_/ /___/
//   __  __                      __         __   __      ___
//  / / / /__  ___ ________ ____/ /__ ___ _/ /  / /__   / _ \_______ __ ____ __
// / /_/ / _ \/ _ `/ __/ _ `/ _  / -_) _ `/ _ \/ / -_) / ___/ __/ _ \\ \ / // /
// \____/ .__/\_, /_/  \_,_/\_,_/\__/\_,_/_.__/_/\__/ /_/  /_/  \___/_\_\\_, /
//     /_/   /___/                                                      /___/
//
// Website:         https://blocksense.network/
// Git Repository:  https://github.com/blocksense-network/blocksense

/// @title UpgradeableProxyADFS
/// @notice Implements an upgradeable proxy for the Blocksense
/// Aggregated Data Feed Store (ADFS) contract.
///
/// @dev Non-management calls are delegated to the contract address stored in
/// IMPLEMENTATION_SLOT, which is upgradeable by the admin stored in the
/// ADMIN_SLOT.
///
/// Storage layout:
///   * Management space: [0 to 2**128-2**116)
///              0x0000 - latest blocknumber (used by the implementation)
///              0x0001 - implementation slot (used by this contract)
///              0x0002 - admin slot (used by this contract)
///                 ... - additional management space reserved for ADFS
///   *  ADFS data space: [2**128-2**116 to 2**160)
///
/// This contract intentionally deviates from the EIP-1967 slot scheme.
/// It was co-designed with ADFS to accomodate its custom low-level
/// storage management requirements.
///
/// Note that this deviation has implications on storage isolation and
/// upgrade safety.
contract UpgradeableProxyADFS {
  /// @notice Storage slot for the implementation address.
  /// @dev Non-management calls are delegated to this address.
  bytes32 internal constant IMPLEMENTATION_SLOT =
    0x0000000000000000000000000000000000000000000000000000000000000001;

  /// @notice Storage slot for the admin address of the upgradeable proxy.
  /// @dev This address is authorized to perform management operations, such as
  /// upgrading the implementation.
  bytes32 internal constant ADMIN_SLOT =
    0x0000000000000000000000000000000000000000000000000000000000000002;

  /// @notice Emitted when the implementation is upgraded
  /// @param implementation The new implementation address
  event Upgraded(address indexed implementation);

  /// @notice Emitted when the admin is changed
  /// @param newAdmin The new admin address
  event AdminSet(address indexed newAdmin);

  /// @notice Thrown when a non-admin attempts to perform an admin-only action.
  error ProxyDeniedAdminAccess();

  /// @notice Thrown when attempting to upgrade to an invalid implementation address.
  /// @param value The address that was attempted for upgrade
  error InvalidUpgrade(address value);

  /// @notice Thrown when an upgrade function sees `msg.value > 0` that may be lost.
  error ERC1967NonPayable();

  /// @notice Construct the UpgradeableProxy contract
  /// @param owner The address of the admin
  /// @param logic The address of the initial implementation
  /// @param data The data to be passed to the implementation
  constructor(address owner, address logic, bytes memory data) payable {
    _setAdmin(owner);
    _upgradeToAndCall(logic, data);
  }

  /// @notice Fallback function
  /// @dev Fallback function for delegating calls to the implementation contract.
  ///
  /// This function delegates non-management calls to the implementation address.
  ///
  /// Management operations are reserved for calls whose first 4 bytes (msg.sig) equal:
  ///   * 0x00000001 - _upgradeToAndCall(address newImplementation, bytes memory data)
  ///   * 0x00000002 - _setAdmin(address newAdmin)
  /// Only the admin is allowed to execute these management operations;
  /// all others will revert with ProxyDeniedAdminAccess.
  ///
  /// Note: Unlike OpenZeppelin's Transparent Proxy, the admin can invoke both
  /// management functions and delegate calls. The implementation contract is responsible
  /// for enforcing any further security measures.
  ///
  /// Note: The 0x00 prefix in the calldata helps avoid clashes in ADFS' custom
  /// function selector.
  fallback() external payable {
    if (msg.sig == 0x00000001 || msg.sig == 0x00000002) {
      bool isAdmin;

      assembly {
        isAdmin := eq(caller(), sload(ADMIN_SLOT))
      }

      if (!isAdmin) revert ProxyDeniedAdminAccess();

      if (msg.sig == 0x00000001) {
        _upgradeToAndCall(address(bytes20(msg.data[4:])), msg.data[24:]);
        return;
      } else if (msg.sig == 0x00000002) {
        _setAdmin(address(bytes20(msg.data[4:])));
        return;
      }
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

      if iszero(result) {
        revert(0, returndatasize())
      }

      // Copy the returned data.
      returndatacopy(0, 0, returndatasize())

      return(0, returndatasize())
    }
  }

  /// @notice Upgrades the implementation to a new contract.
  /// @param newImplementation The address of the new implementation
  /// @dev Validates that the new address contains contract code before
  /// storing.
  function _upgradeToAndCall(
    address newImplementation,
    bytes memory data
  ) internal {
    if (newImplementation.code.length == 0) {
      revert InvalidUpgrade(newImplementation);
    }

    assembly {
      sstore(IMPLEMENTATION_SLOT, newImplementation)
    }
    emit Upgraded(newImplementation);

    if (data.length > 0) {
      assembly {
        let result := delegatecall(
          gas(),
          newImplementation,
          add(data, 0x20),
          mload(data),
          0,
          0
        )
        if iszero(result) {
          revert(0, 0)
        }
      }
    } else if (msg.value > 0) {
      revert ERC1967NonPayable();
    }
  }

  /// @notice Sets a new admin address for the proxy.
  /// @param newAdmin The address of the new admin.
  /// @dev Passing address(0) revokes further upgrade permissions.
  function _setAdmin(address newAdmin) internal {
    assembly {
      sstore(ADMIN_SLOT, newAdmin)
    }
    emit AdminSet(newAdmin);
  }
}
