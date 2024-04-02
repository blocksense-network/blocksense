// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {Proxy} from '@openzeppelin/contracts/proxy/Proxy.sol';
import {ERC1967Utils} from '@openzeppelin/contracts/proxy/ERC1967/ERC1967Utils.sol';
import {IERC1967} from '@openzeppelin/contracts/interfaces/IERC1967.sol';

interface ITransparentUpgradeableProxy is IERC1967 {
  function upgradeToAndCall(address, bytes calldata) external payable;
}

contract UpgradableProxy is Proxy {
  address private immutable _admin;

  error ProxyDeniedAdminAccess();

  constructor(address _logic, address initialOwner) {
    ERC1967Utils.upgradeToAndCall(_logic, '');

    _admin = address(initialOwner);
  }

  function _implementation() internal view virtual override returns (address) {
    return ERC1967Utils.getImplementation();
  }

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

  function _dispatchUpgradeToAndCall() private {
    address newImplementation = address(bytes20(msg.data[4:]));
    ERC1967Utils.upgradeToAndCall(newImplementation, '');
  }
}
