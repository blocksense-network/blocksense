// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title UpgradeableProxyADFS
/// @notice Proxy contract that allows the implementation to be upgraded
/// @dev This contract is reuses logic from the OpenZeppelin Transparent Proxy contract
contract UpgradeableProxyADFS {
  /// @notice Slot for the implementation address
  /// @dev The first 4096 addresses are reserved for management values
  /// The first address (0x0000) is reserved for the blocknumber
  /// For more information, see libs/ts/contracts/contracts/AggregatedDataFeedStore.sol
  bytes32 internal constant IMPLEMENTATION_SLOT =
    0x0000000000000000000000000000000000000000000000000000000000000001;

  /// @notice Slot for the admin of the uprgadeable proxy
  bytes32 internal constant ADMIN_SLOT =
    0x0000000000000000000000000000000000000000000000000000000000000002;

  bytes4 internal constant UPGRADE_TO_AND_CALL_SELECTOR = 0x00000001;
  bytes4 internal constant SET_ADMIN_SELECTOR = 0x00000002;

  event Upgraded(address indexed implementation);
  event AdminSet(address indexed newAdmin);

  error ProxyDeniedAdminAccess();
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
  /// @dev The fallback function is used to delegate calls to the implementation contract
  /// If the sender is the admin, the function will either upgrade to a new
  /// implementation or change the admin, depending on the message signature.
  /// In contrast to OZ's Transparent Proxy, the admin can call this contract to modify the proxy, as well as call the
  /// proxied contract.
  /// All admin function selectors must have the first byte set to 0x00.
  fallback() external payable {
    bool isAdmin;

    if (msg.sig == UPGRADE_TO_AND_CALL_SELECTOR || msg.sig == SET_ADMIN_SELECTOR) {
      assembly {
        isAdmin := eq(caller(), sload(ADMIN_SLOT))
      }

      if (!isAdmin) revert ProxyDeniedAdminAccess();

      if (msg.sig == UPGRADE_TO_AND_CALL_SELECTOR) {
        _upgradeToAndCall(address(bytes20(msg.data[4:])), msg.data[24:]);
        return;
      } else if (msg.sig == SET_ADMIN_SELECTOR) {
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

  /// @notice Upgrade the implementation to a new implementation
  /// @param newImplementation The address of the new implementation
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

  /// @notice Change the owner of the upgradable proxy
  /// @param newAdmin The address of the new admin
  function _setAdmin(address newAdmin) internal {
    assembly {
      sstore(ADMIN_SLOT, newAdmin)
    }
    emit AdminSet(newAdmin);
  }
}
