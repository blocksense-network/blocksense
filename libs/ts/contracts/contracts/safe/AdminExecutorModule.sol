// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import '@safe-global/safe-contracts/contracts/base/ModuleManager.sol';

/// @title AdminExecutorModule
/// @author Aneta Tsvetkova
/// @notice Module that allows the admin multisig to execute transactions on the multisig
/// @dev This module is used to execute transactions on the multisig from the admin multisig
contract AdminExecutorModule {
  address payable public immutable MULTISIG;
  address public immutable ADMIN_MULTISIG;

  error OnlyAdminMultisig();

  constructor(address multisig, address adminMultisig) {
    MULTISIG = payable(multisig);
    ADMIN_MULTISIG = adminMultisig;
  }

  function executeTransaction(bytes calldata data) external {
    if (msg.sender != ADMIN_MULTISIG) {
      revert OnlyAdminMultisig();
    }

    ModuleManager(MULTISIG).execTransactionFromModule(
      MULTISIG,
      0,
      data,
      Enum.Operation.Call
    );
  }
}
