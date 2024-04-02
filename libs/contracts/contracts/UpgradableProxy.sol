// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {ERC1967Proxy} from '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol';
import {ERC1967Utils} from '@openzeppelin/contracts/proxy/ERC1967/ERC1967Utils.sol';
import {IERC1967} from '@openzeppelin/contracts/interfaces/IERC1967.sol';

interface ITransparentUpgradeableProxy is IERC1967 {
  function upgradeToAndCall(address, bytes calldata) external payable;
}

contract UpgradableProxy is ERC1967Proxy {
  address private immutable _admin;

  error ProxyDeniedAdminAccess();

  constructor(
    address _logic,
    address initialOwner
  ) payable ERC1967Proxy(_logic, '') {
    _admin = address(initialOwner);
    // Set the storage value and emit an event for ERC-1967 compatibility
    ERC1967Utils.changeAdmin(initialOwner);
  }

  function implementation() external view returns (address) {
    return ERC1967Utils.getImplementation();
  }

  /**
   * @dev If caller is the admin process the call internally, otherwise transparently fallback to the proxy behavior.
   */
  function _fallback() internal virtual override {
    if (msg.sender == _admin) {
      if (msg.sig != ITransparentUpgradeableProxy.upgradeToAndCall.selector) {
        revert ProxyDeniedAdminAccess();
      } else {
        _dispatchUpgradeToAndCall();
      }
    } else {
      super._fallback();
    }
  }

  /**
   * @dev Upgrade the implementation of the proxy. See {ERC1967Utils-upgradeToAndCall}.
   *
   * Requirements:
   *
   * - If `data` is empty, `msg.value` must be zero.
   */
  function _dispatchUpgradeToAndCall() private {
    address newImplementation = address(bytes20(msg.data[4:24]));
    ERC1967Utils.upgradeToAndCall(newImplementation, '');
  }
}
