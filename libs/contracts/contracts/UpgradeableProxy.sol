// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Proxy} from '@openzeppelin/contracts/proxy/Proxy.sol';
import {ITransparentUpgradeableProxy} from '@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol';

contract UpgradeableProxy is Proxy {
  bytes32 internal constant IMPLEMENTATION_SLOT =
    0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
  address private immutable _admin;

  event Upgraded(address indexed implementation);

  error ProxyDeniedAdminAccess();
  error InvalidImplementation(address implementation);

  constructor(address _logic, address initialOwner) {
    _admin = initialOwner;
    _upgradeTo(_logic);
  }

  function _implementation() internal view override returns (address impl) {
    assembly {
      impl := sload(IMPLEMENTATION_SLOT)
    }
  }

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

  function _dispatchUpgradeTo() internal {
    address newImplementation = address(bytes20(msg.data[4:]));
    _upgradeTo(newImplementation);
  }

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
