// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IUpgradeableProxy {
  /// @notice Upgrade the implementation of the proxy to a new implementation
  /// @param newImplementation The address of the new implementation
  function upgradeTo(address newImplementation) external;

  /// @notice Change the admin of the proxy
  /// @param newAdmin The address of the new admin
  function setAdmin(address newAdmin) external;
}
