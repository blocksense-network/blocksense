// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import '@safe-global/safe-contracts/contracts/common/Enum.sol';
import '@safe-global/safe-contracts/contracts/base/GuardManager.sol';

/// @title OnlySequencerGuard
/// @notice Guard that restricts signed dataFeedStore calls to be only executed by the sequencer
contract OnlySequencerGuard is BaseGuard {
  mapping(address => bool) public sequencers;
  address internal immutable MULTISIG;
  address internal immutable ADMIN_MULTISIG;
  address internal immutable ADFS;

  error OnlyAdminMultisig();
  error ExecutorNotSequencer();

  constructor(address multisig, address adminMultisig, address adfs) {
    MULTISIG = multisig;
    ADMIN_MULTISIG = adminMultisig;
    ADFS = adfs;
  }

  fallback() external {
    // We don't revert on fallback to avoid issues in case of a Safe upgrade
    // E.g. The expected check method might change and then the Safe would be locked.
  }

  /// @notice Sets the sequencer role
  /// @dev can be called only by the admin multisig
  /// @param sequencer The address of the sequencer
  /// @param status The status of the sequencer
  function setSequencer(address sequencer, bool status) external {
    if (ADMIN_MULTISIG != msg.sender) {
      revert OnlyAdminMultisig();
    }
    sequencers[sequencer] = status;
  }

  /// @notice Gets the sequencer role
  /// @param sequencer The address of the sequencer
  /// @return status The status of the sequencer
  function getSequencerRole(address sequencer) external view returns (bool) {
    return sequencers[sequencer];
  }

  /**
   * @notice Called by the Safe contract before a transaction is executed.
   * @dev Reverts if the transaction is not executed by an owner.
   * @param to Destination address of the transaction.
   * @param msgSender Executor of the transaction.
   */
  function checkTransaction(
    address to,
    uint256,
    bytes memory,
    Enum.Operation,
    uint256,
    uint256,
    uint256,
    address,
    address payable,
    bytes memory,
    address msgSender
  ) external view override {
    if (to == ADFS && !sequencers[msgSender]) {
      revert ExecutorNotSequencer();
    }

    if (to == MULTISIG && msgSender != ADMIN_MULTISIG) {
      revert OnlyAdminMultisig();
    }
  }

  /**
   * @notice Called by the Safe contract after a transaction is executed.
   * @dev No-op.
   */
  function checkAfterExecution(bytes32, bool) external view override {}
}
