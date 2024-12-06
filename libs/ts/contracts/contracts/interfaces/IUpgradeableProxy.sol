// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IUpgradeableProxy {
  function upgradeTo(address newImplementation) external;

  function setAdmin(address newAdmin) external;
}
