// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library Enum {
  enum Operation {
    Call,
    DelegateCall
  }
}

interface IERC165 {
  /**
   * @dev Returns true if this contract implements the interface defined by `interfaceId`.
   * See the corresponding EIP section
   * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified
   * to learn more about how these ids are created.
   *
   * This function call must use less than 30 000 gas.
   */
  function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

interface ITransactionGuard is IERC165 {
  /**
   * @notice Checks the transaction details.
   * @dev The function needs to implement transaction validation logic.
   * @param to The address to which the transaction is intended.
   * @param value The value of the transaction in Wei.
   * @param data The transaction data.
   * @param operation The type of operation of the transaction.
   * @param safeTxGas Gas used for the transaction.
   * @param baseGas The base gas for the transaction.
   * @param gasPrice The price of gas in Wei for the transaction.
   * @param gasToken The token used to pay for gas.
   * @param refundReceiver The address which should receive the refund.
   * @param signatures The signatures of the transaction.
   * @param msgSender The address of the message sender.
   */
  function checkTransaction(
    address to,
    uint256 value,
    bytes memory data,
    Enum.Operation operation,
    uint256 safeTxGas,
    uint256 baseGas,
    uint256 gasPrice,
    address gasToken,
    address payable refundReceiver,
    bytes memory signatures,
    address msgSender
  ) external;

  /**
   * @notice Checks after execution of the transaction.
   * @dev The function needs to implement a check after the execution of the transaction.
   * @param hash The hash of the transaction.
   * @param success The status of the transaction execution.
   */
  function checkAfterExecution(bytes32 hash, bool success) external;
}

abstract contract BaseTransactionGuard is ITransactionGuard {
  function supportsInterface(
    bytes4 interfaceId
  ) external view virtual override returns (bool) {
    return
      interfaceId == type(ITransactionGuard).interfaceId || // 0xe6d7a83a
      interfaceId == type(IERC165).interfaceId; // 0x01ffc9a7
  }
}

interface ISafe {
  function isOwner(address owner) external view returns (bool);
}

/**
 * @title OnlyOwnersGuard - Only allows owners to execute transactions.
 * @author Richard Meissner - @rmeissner
 */
contract OnlySequencersGuard is BaseTransactionGuard {
  mapping(address => bool) public sequencers;
  address internal immutable MULTISIG;
  constructor(address multisig) {
    MULTISIG = multisig;
  }

  // solhint-disable-next-line payable-fallback
  fallback() external {
    // We don't revert on fallback to avoid issues in case of a Safe upgrade
    // E.g. The expected check method might change and then the Safe would be locked.
  }

  function setSequencer(address sequencer, bool status) external {
    require(ISafe(MULTISIG).isOwner(msg.sender), '1');
    sequencers[sequencer] = status;
  }

  /**
   * @notice Called by the Safe contract before a transaction is executed.
   * @dev Reverts if the transaction is not executed by an owner.
   * @param msgSender Executor of the transaction.
   */
  function checkTransaction(
    address,
    uint256,
    bytes memory,
    Enum.Operation,
    uint256,
    uint256,
    uint256,
    address,
    // solhint-disable-next-line no-unused-vars
    address payable,
    bytes memory,
    address msgSender
  ) external view override {
    require(sequencers[msgSender], '2');
  }

  /**
   * @notice Called by the Safe contract after a transaction is executed.
   * @dev No-op.
   */
  function checkAfterExecution(bytes32, bool) external view override {}
}
