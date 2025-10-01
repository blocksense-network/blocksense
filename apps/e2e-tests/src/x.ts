// morpho-borrow-rate-poc.ts
// Run:  node -r ts-node/register morpho-borrow-rate-poc.ts
// Env:  ETH_RPC_URL=<https mainnet RPC>

import { cons } from 'effect/List';
import type { Address } from 'viem';
import {
  createPublicClient,
  http,
  keccak256,
  encodeAbiParameters,
  parseAbi,
  Hex,
} from 'viem';
import { mainnet } from 'viem/chains';

// --- Config ---
const RPC_URL = process.env.RPC_URL_ETHEREUM_MAINNET!;
if (!RPC_URL) throw new Error('Set ETH_RPC_URL');

const MORPHO_CORE: Address = '0xbbbbbbbbbb9cc5e90e3b3af64bdaf62c37eeffcb'; // blue.morpho.eth (mainnet)

// Example MarketParams (USDC / WETH / <your oracle> / IRM / LLTV):
// IMPORTANT: Use the EXACT oracle + IRM + LLTV for the market you track.
// You can compute the id from these and then cross-check on-chain via idToMarketParams.
// const MARKET_PARAMS = {
//   loanToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address, // USDC
//   collateralToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address, // WETH
//   oracle: '0xA6D6950c9F177F1De7f7757FB33539e3Ec60182a' as Address, // TODO: put the real oracle for your market
//   irm: '0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC' as Address, // TODO: DO NOT hardcode in prod; we'll read it from core
//   lltv: 900000000000000000n, // 90% in WAD (1e18)
// };

// --- Minimal ABIs ---
const MORPHO_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'newOwner', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'Id', name: 'id', type: 'bytes32' },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'prevBorrowRate',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'interest',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'feeShares',
        type: 'uint256',
      },
    ],
    name: 'AccrueInterest',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'Id', name: 'id', type: 'bytes32' },
      {
        indexed: false,
        internalType: 'address',
        name: 'caller',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'onBehalf',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'receiver',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'assets',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'shares',
        type: 'uint256',
      },
    ],
    name: 'Borrow',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'Id', name: 'id', type: 'bytes32' },
      {
        components: [
          { internalType: 'address', name: 'loanToken', type: 'address' },
          { internalType: 'address', name: 'collateralToken', type: 'address' },
          { internalType: 'address', name: 'oracle', type: 'address' },
          { internalType: 'address', name: 'irm', type: 'address' },
          { internalType: 'uint256', name: 'lltv', type: 'uint256' },
        ],
        indexed: false,
        internalType: 'struct MarketParams',
        name: 'marketParams',
        type: 'tuple',
      },
    ],
    name: 'CreateMarket',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'irm', type: 'address' },
    ],
    name: 'EnableIrm',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'uint256',
        name: 'lltv',
        type: 'uint256',
      },
    ],
    name: 'EnableLltv',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'caller',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'token',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'assets',
        type: 'uint256',
      },
    ],
    name: 'FlashLoan',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'caller',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'authorizer',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'usedNonce',
        type: 'uint256',
      },
    ],
    name: 'IncrementNonce',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'Id', name: 'id', type: 'bytes32' },
      {
        indexed: true,
        internalType: 'address',
        name: 'caller',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'borrower',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'repaidAssets',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'repaidShares',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'seizedAssets',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'badDebtAssets',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'badDebtShares',
        type: 'uint256',
      },
    ],
    name: 'Liquidate',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'Id', name: 'id', type: 'bytes32' },
      {
        indexed: true,
        internalType: 'address',
        name: 'caller',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'onBehalf',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'assets',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'shares',
        type: 'uint256',
      },
    ],
    name: 'Repay',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'caller',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'authorizer',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'authorized',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'bool',
        name: 'newIsAuthorized',
        type: 'bool',
      },
    ],
    name: 'SetAuthorization',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'Id', name: 'id', type: 'bytes32' },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'newFee',
        type: 'uint256',
      },
    ],
    name: 'SetFee',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'newFeeRecipient',
        type: 'address',
      },
    ],
    name: 'SetFeeRecipient',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'newOwner',
        type: 'address',
      },
    ],
    name: 'SetOwner',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'Id', name: 'id', type: 'bytes32' },
      {
        indexed: true,
        internalType: 'address',
        name: 'caller',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'onBehalf',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'assets',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'shares',
        type: 'uint256',
      },
    ],
    name: 'Supply',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'Id', name: 'id', type: 'bytes32' },
      {
        indexed: true,
        internalType: 'address',
        name: 'caller',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'onBehalf',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'assets',
        type: 'uint256',
      },
    ],
    name: 'SupplyCollateral',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'Id', name: 'id', type: 'bytes32' },
      {
        indexed: false,
        internalType: 'address',
        name: 'caller',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'onBehalf',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'receiver',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'assets',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'shares',
        type: 'uint256',
      },
    ],
    name: 'Withdraw',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'Id', name: 'id', type: 'bytes32' },
      {
        indexed: false,
        internalType: 'address',
        name: 'caller',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'onBehalf',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'receiver',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'assets',
        type: 'uint256',
      },
    ],
    name: 'WithdrawCollateral',
    type: 'event',
  },
  {
    inputs: [],
    name: 'DOMAIN_SEPARATOR',
    outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'loanToken', type: 'address' },
          { internalType: 'address', name: 'collateralToken', type: 'address' },
          { internalType: 'address', name: 'oracle', type: 'address' },
          { internalType: 'address', name: 'irm', type: 'address' },
          { internalType: 'uint256', name: 'lltv', type: 'uint256' },
        ],
        internalType: 'struct MarketParams',
        name: 'marketParams',
        type: 'tuple',
      },
    ],
    name: 'accrueInterest',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'loanToken', type: 'address' },
          { internalType: 'address', name: 'collateralToken', type: 'address' },
          { internalType: 'address', name: 'oracle', type: 'address' },
          { internalType: 'address', name: 'irm', type: 'address' },
          { internalType: 'uint256', name: 'lltv', type: 'uint256' },
        ],
        internalType: 'struct MarketParams',
        name: 'marketParams',
        type: 'tuple',
      },
      { internalType: 'uint256', name: 'assets', type: 'uint256' },
      { internalType: 'uint256', name: 'shares', type: 'uint256' },
      { internalType: 'address', name: 'onBehalf', type: 'address' },
      { internalType: 'address', name: 'receiver', type: 'address' },
    ],
    name: 'borrow',
    outputs: [
      { internalType: 'uint256', name: '', type: 'uint256' },
      { internalType: 'uint256', name: '', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'loanToken', type: 'address' },
          { internalType: 'address', name: 'collateralToken', type: 'address' },
          { internalType: 'address', name: 'oracle', type: 'address' },
          { internalType: 'address', name: 'irm', type: 'address' },
          { internalType: 'uint256', name: 'lltv', type: 'uint256' },
        ],
        internalType: 'struct MarketParams',
        name: 'marketParams',
        type: 'tuple',
      },
    ],
    name: 'createMarket',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'irm', type: 'address' }],
    name: 'enableIrm',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'lltv', type: 'uint256' }],
    name: 'enableLltv',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32[]', name: 'slots', type: 'bytes32[]' }],
    name: 'extSloads',
    outputs: [{ internalType: 'bytes32[]', name: 'res', type: 'bytes32[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'feeRecipient',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'token', type: 'address' },
      { internalType: 'uint256', name: 'assets', type: 'uint256' },
      { internalType: 'bytes', name: 'data', type: 'bytes' },
    ],
    name: 'flashLoan',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'Id', name: '', type: 'bytes32' }],
    name: 'idToMarketParams',
    outputs: [
      { internalType: 'address', name: 'loanToken', type: 'address' },
      { internalType: 'address', name: 'collateralToken', type: 'address' },
      { internalType: 'address', name: 'oracle', type: 'address' },
      { internalType: 'address', name: 'irm', type: 'address' },
      { internalType: 'uint256', name: 'lltv', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: '', type: 'address' },
      { internalType: 'address', name: '', type: 'address' },
    ],
    name: 'isAuthorized',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: '', type: 'address' }],
    name: 'isIrmEnabled',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    name: 'isLltvEnabled',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'loanToken', type: 'address' },
          { internalType: 'address', name: 'collateralToken', type: 'address' },
          { internalType: 'address', name: 'oracle', type: 'address' },
          { internalType: 'address', name: 'irm', type: 'address' },
          { internalType: 'uint256', name: 'lltv', type: 'uint256' },
        ],
        internalType: 'struct MarketParams',
        name: 'marketParams',
        type: 'tuple',
      },
      { internalType: 'address', name: 'borrower', type: 'address' },
      { internalType: 'uint256', name: 'seizedAssets', type: 'uint256' },
      { internalType: 'uint256', name: 'repaidShares', type: 'uint256' },
      { internalType: 'bytes', name: 'data', type: 'bytes' },
    ],
    name: 'liquidate',
    outputs: [
      { internalType: 'uint256', name: '', type: 'uint256' },
      { internalType: 'uint256', name: '', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'Id', name: '', type: 'bytes32' }],
    name: 'market',
    outputs: [
      { internalType: 'uint128', name: 'totalSupplyAssets', type: 'uint128' },
      { internalType: 'uint128', name: 'totalSupplyShares', type: 'uint128' },
      { internalType: 'uint128', name: 'totalBorrowAssets', type: 'uint128' },
      { internalType: 'uint128', name: 'totalBorrowShares', type: 'uint128' },
      { internalType: 'uint128', name: 'lastUpdate', type: 'uint128' },
      { internalType: 'uint128', name: 'fee', type: 'uint128' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: '', type: 'address' }],
    name: 'nonce',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'Id', name: '', type: 'bytes32' },
      { internalType: 'address', name: '', type: 'address' },
    ],
    name: 'position',
    outputs: [
      { internalType: 'uint256', name: 'supplyShares', type: 'uint256' },
      { internalType: 'uint128', name: 'borrowShares', type: 'uint128' },
      { internalType: 'uint128', name: 'collateral', type: 'uint128' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'loanToken', type: 'address' },
          { internalType: 'address', name: 'collateralToken', type: 'address' },
          { internalType: 'address', name: 'oracle', type: 'address' },
          { internalType: 'address', name: 'irm', type: 'address' },
          { internalType: 'uint256', name: 'lltv', type: 'uint256' },
        ],
        internalType: 'struct MarketParams',
        name: 'marketParams',
        type: 'tuple',
      },
      { internalType: 'uint256', name: 'assets', type: 'uint256' },
      { internalType: 'uint256', name: 'shares', type: 'uint256' },
      { internalType: 'address', name: 'onBehalf', type: 'address' },
      { internalType: 'bytes', name: 'data', type: 'bytes' },
    ],
    name: 'repay',
    outputs: [
      { internalType: 'uint256', name: '', type: 'uint256' },
      { internalType: 'uint256', name: '', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'authorized', type: 'address' },
      { internalType: 'bool', name: 'newIsAuthorized', type: 'bool' },
    ],
    name: 'setAuthorization',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'authorizer', type: 'address' },
          { internalType: 'address', name: 'authorized', type: 'address' },
          { internalType: 'bool', name: 'isAuthorized', type: 'bool' },
          { internalType: 'uint256', name: 'nonce', type: 'uint256' },
          { internalType: 'uint256', name: 'deadline', type: 'uint256' },
        ],
        internalType: 'struct Authorization',
        name: 'authorization',
        type: 'tuple',
      },
      {
        components: [
          { internalType: 'uint8', name: 'v', type: 'uint8' },
          { internalType: 'bytes32', name: 'r', type: 'bytes32' },
          { internalType: 'bytes32', name: 's', type: 'bytes32' },
        ],
        internalType: 'struct Signature',
        name: 'signature',
        type: 'tuple',
      },
    ],
    name: 'setAuthorizationWithSig',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'loanToken', type: 'address' },
          { internalType: 'address', name: 'collateralToken', type: 'address' },
          { internalType: 'address', name: 'oracle', type: 'address' },
          { internalType: 'address', name: 'irm', type: 'address' },
          { internalType: 'uint256', name: 'lltv', type: 'uint256' },
        ],
        internalType: 'struct MarketParams',
        name: 'marketParams',
        type: 'tuple',
      },
      { internalType: 'uint256', name: 'newFee', type: 'uint256' },
    ],
    name: 'setFee',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'newFeeRecipient', type: 'address' },
    ],
    name: 'setFeeRecipient',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'newOwner', type: 'address' }],
    name: 'setOwner',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'loanToken', type: 'address' },
          { internalType: 'address', name: 'collateralToken', type: 'address' },
          { internalType: 'address', name: 'oracle', type: 'address' },
          { internalType: 'address', name: 'irm', type: 'address' },
          { internalType: 'uint256', name: 'lltv', type: 'uint256' },
        ],
        internalType: 'struct MarketParams',
        name: 'marketParams',
        type: 'tuple',
      },
      { internalType: 'uint256', name: 'assets', type: 'uint256' },
      { internalType: 'uint256', name: 'shares', type: 'uint256' },
      { internalType: 'address', name: 'onBehalf', type: 'address' },
      { internalType: 'bytes', name: 'data', type: 'bytes' },
    ],
    name: 'supply',
    outputs: [
      { internalType: 'uint256', name: '', type: 'uint256' },
      { internalType: 'uint256', name: '', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'loanToken', type: 'address' },
          { internalType: 'address', name: 'collateralToken', type: 'address' },
          { internalType: 'address', name: 'oracle', type: 'address' },
          { internalType: 'address', name: 'irm', type: 'address' },
          { internalType: 'uint256', name: 'lltv', type: 'uint256' },
        ],
        internalType: 'struct MarketParams',
        name: 'marketParams',
        type: 'tuple',
      },
      { internalType: 'uint256', name: 'assets', type: 'uint256' },
      { internalType: 'address', name: 'onBehalf', type: 'address' },
      { internalType: 'bytes', name: 'data', type: 'bytes' },
    ],
    name: 'supplyCollateral',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'loanToken', type: 'address' },
          { internalType: 'address', name: 'collateralToken', type: 'address' },
          { internalType: 'address', name: 'oracle', type: 'address' },
          { internalType: 'address', name: 'irm', type: 'address' },
          { internalType: 'uint256', name: 'lltv', type: 'uint256' },
        ],
        internalType: 'struct MarketParams',
        name: 'marketParams',
        type: 'tuple',
      },
      { internalType: 'uint256', name: 'assets', type: 'uint256' },
      { internalType: 'uint256', name: 'shares', type: 'uint256' },
      { internalType: 'address', name: 'onBehalf', type: 'address' },
      { internalType: 'address', name: 'receiver', type: 'address' },
    ],
    name: 'withdraw',
    outputs: [
      { internalType: 'uint256', name: '', type: 'uint256' },
      { internalType: 'uint256', name: '', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'loanToken', type: 'address' },
          { internalType: 'address', name: 'collateralToken', type: 'address' },
          { internalType: 'address', name: 'oracle', type: 'address' },
          { internalType: 'address', name: 'irm', type: 'address' },
          { internalType: 'uint256', name: 'lltv', type: 'uint256' },
        ],
        internalType: 'struct MarketParams',
        name: 'marketParams',
        type: 'tuple',
      },
      { internalType: 'uint256', name: 'assets', type: 'uint256' },
      { internalType: 'address', name: 'onBehalf', type: 'address' },
      { internalType: 'address', name: 'receiver', type: 'address' },
    ],
    name: 'withdrawCollateral',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

const IRM_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'morpho', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'Id', name: 'id', type: 'bytes32' },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'avgBorrowRate',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'rateAtTarget',
        type: 'uint256',
      },
    ],
    name: 'BorrowRateUpdate',
    type: 'event',
  },
  {
    inputs: [],
    name: 'MORPHO',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'loanToken', type: 'address' },
          { internalType: 'address', name: 'collateralToken', type: 'address' },
          { internalType: 'address', name: 'oracle', type: 'address' },
          { internalType: 'address', name: 'irm', type: 'address' },
          { internalType: 'uint256', name: 'lltv', type: 'uint256' },
        ],
        internalType: 'struct MarketParams',
        name: 'marketParams',
        type: 'tuple',
      },
      {
        components: [
          {
            internalType: 'uint128',
            name: 'totalSupplyAssets',
            type: 'uint128',
          },
          {
            internalType: 'uint128',
            name: 'totalSupplyShares',
            type: 'uint128',
          },
          {
            internalType: 'uint128',
            name: 'totalBorrowAssets',
            type: 'uint128',
          },
          {
            internalType: 'uint128',
            name: 'totalBorrowShares',
            type: 'uint128',
          },
          { internalType: 'uint128', name: 'lastUpdate', type: 'uint128' },
          { internalType: 'uint128', name: 'fee', type: 'uint128' },
        ],
        internalType: 'struct Market',
        name: 'market',
        type: 'tuple',
      },
    ],
    name: 'borrowRate',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'loanToken', type: 'address' },
          { internalType: 'address', name: 'collateralToken', type: 'address' },
          { internalType: 'address', name: 'oracle', type: 'address' },
          { internalType: 'address', name: 'irm', type: 'address' },
          { internalType: 'uint256', name: 'lltv', type: 'uint256' },
        ],
        internalType: 'struct MarketParams',
        name: 'marketParams',
        type: 'tuple',
      },
      {
        components: [
          {
            internalType: 'uint128',
            name: 'totalSupplyAssets',
            type: 'uint128',
          },
          {
            internalType: 'uint128',
            name: 'totalSupplyShares',
            type: 'uint128',
          },
          {
            internalType: 'uint128',
            name: 'totalBorrowAssets',
            type: 'uint128',
          },
          {
            internalType: 'uint128',
            name: 'totalBorrowShares',
            type: 'uint128',
          },
          { internalType: 'uint128', name: 'lastUpdate', type: 'uint128' },
          { internalType: 'uint128', name: 'fee', type: 'uint128' },
        ],
        internalType: 'struct Market',
        name: 'market',
        type: 'tuple',
      },
    ],
    name: 'borrowRateView',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'Id', name: '', type: 'bytes32' }],
    name: 'rateAtTarget',
    outputs: [{ internalType: 'int256', name: '', type: 'int256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

// --- Helpers ---
const WAD = 10n ** 18n;
const SECONDS_PER_YEAR = 31_536_000n;

// function encodeMarketParams(p: {
//   loanToken: Address;
//   collateralToken: Address;
//   oracle: Address;
//   irm: Address;
//   lltv: bigint;
// }): Hex {
//   return encodeAbiParameters(
//     [
//       { name: 'loanToken', type: 'address' },
//       { name: 'collateralToken', type: 'address' },
//       { name: 'oracle', type: 'address' },
//       { name: 'irm', type: 'address' },
//       { name: 'lltv', type: 'uint256' },
//     ],
//     [p.loanToken, p.collateralToken, p.oracle, p.irm, p.lltv],
//   );
// }

// function marketIdOf(p: typeof MARKET_PARAMS): Hex {
//   return keccak256(encodeMarketParams(p));
// }

function wadToDecimalString(x: bigint, decimals = 18): string {
  const s = x.toString().padStart(decimals + 1, '0');
  const i = s.slice(0, -decimals);
  const f = s.slice(-decimals).replace(/0+$/, '');
  return f.length ? `${i}.${f}` : i;
}

function toAprPercent(perSecWad: bigint): number {
  // APR ~= (perSecWad * secondsPerYear) / 1e18
  console.log('perSecWad                   ', perSecWad);
  console.log('perSecWad * SECONDS_PER_YEAR', perSecWad * SECONDS_PER_YEAR);
  console.log('WAD                         ', WAD);
  console.log(
    '(perSecWad * SECONDS_PER_YEAR) / WAD',
    (perSecWad * SECONDS_PER_YEAR) / WAD,
  );
  const num = Number((perSecWad * SECONDS_PER_YEAR * 100n) / WAD);
  console.log('APR', num);
  return num * 100;
}

function toApyPercent(perSecWad: bigint): number {
  // APY = exp((perSecWad / 1e18) * secondsPerYear) - 1
  const ratePerSec = Number(perSecWad) / 1e18; // ok for PoC; use a big-dec lib in prod
  const yearly = ratePerSec * Number(SECONDS_PER_YEAR);
  return (Math.exp(yearly) - 1) * 100;
}

// --- Main ---
async function main() {
  const client = createPublicClient({
    chain: mainnet,
    transport: http(RPC_URL),
  });

  // 1) Compute market id from your configured MarketParams
  const id =
    '0x64d65c9a2d91c36d56fbc42d69e979335320169b3df63bf92789e2c8883fcc64';
  console.log('Computed market id:', id);

  // 2) Load canonical MarketParams + Market from core (trust on-chain, not our inputs)
  const onchainParams = await client.readContract({
    address: MORPHO_CORE,
    abi: MORPHO_ABI,
    functionName: 'idToMarketParams',
    args: [id],
  });

  console.log('On-chain market params:');
  console.log(onchainParams);

  const market = await client.readContract({
    address: MORPHO_CORE,
    abi: MORPHO_ABI,
    functionName: 'market',
    args: [id],
  });

  console.log('On-chain market state:');
  console.log(market);

  // 3) Call IRM.borrowRateView(params, market)
  const perSecWad = (await client.readContract({
    address: onchainParams[3] as Address,
    abi: IRM_ABI,
    functionName: 'borrowRateView',
    args: [
      {
        loanToken: onchainParams[0] as Address,
        collateralToken: onchainParams[1] as Address,
        oracle: onchainParams[2] as Address,
        irm: onchainParams[3] as Address,
        lltv: BigInt(onchainParams[4]),
      },
      {
        totalSupplyAssets: BigInt(market[0]),
        totalSupplyShares: BigInt(market[1]),
        totalBorrowAssets: BigInt(market[2]),
        totalBorrowShares: BigInt(market[3]),
        lastUpdate: BigInt(market[4]),
        fee: BigInt(market[5]),
      },
    ],
  })) as bigint;

  console.log('aaaa', perSecWad);
  // 4) Convert
  const aprPct = toAprPercent(perSecWad);
  const apyPct = toApyPercent(perSecWad);

  console.log('Market Id:', id);
  console.log('IRM:', onchainParams[3]);
  console.log('Borrow rate per second (WAD):', wadToDecimalString(perSecWad));
  console.log('Linear APR (%):', aprPct);
  console.log('APY (%):', apyPct.toFixed(4));
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
