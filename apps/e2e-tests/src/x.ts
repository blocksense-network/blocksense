import { JsonRpcProvider, Contract } from 'ethers';

const RPC = 'https://rpc.hyperliquid.xyz/evm';
const provider = new JsonRpcProvider(RPC);

const ADDRESSES = {
  poolAddressesProvider: '0xA73ff12D177D8F1Ec938c3ba0e87D33524dD5594',
  uiPoolDataProvider: '0x7b883191011AEAe40581d3Fa1B112413808C9c00',
};

const uiAbi = [
  {
    inputs: [{ internalType: 'address', name: 'provider', type: 'address' }],
    name: 'getReservesData',
    outputs: [
      {
        components: [
          {
            internalType: 'address',
            name: 'underlyingAsset',
            type: 'address',
          },
          { internalType: 'string', name: 'name', type: 'string' },
          { internalType: 'string', name: 'symbol', type: 'string' },
          { internalType: 'uint256', name: 'decimals', type: 'uint256' },
          {
            internalType: 'uint256',
            name: 'baseLTVasCollateral',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'reserveLiquidationThreshold',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'reserveLiquidationBonus',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'reserveFactor',
            type: 'uint256',
          },
          {
            internalType: 'bool',
            name: 'usageAsCollateralEnabled',
            type: 'bool',
          },
          {
            internalType: 'bool',
            name: 'borrowingEnabled',
            type: 'bool',
          },
          {
            internalType: 'bool',
            name: 'stableBorrowRateEnabled',
            type: 'bool',
          },
          { internalType: 'bool', name: 'isActive', type: 'bool' },
          { internalType: 'bool', name: 'isFrozen', type: 'bool' },
          {
            internalType: 'uint128',
            name: 'liquidityIndex',
            type: 'uint128',
          },
          {
            internalType: 'uint128',
            name: 'variableBorrowIndex',
            type: 'uint128',
          },
          {
            internalType: 'uint128',
            name: 'liquidityRate',
            type: 'uint128',
          },
          {
            internalType: 'uint128',
            name: 'variableBorrowRate',
            type: 'uint128',
          },
          {
            internalType: 'uint128',
            name: 'stableBorrowRate',
            type: 'uint128',
          },
          {
            internalType: 'uint40',
            name: 'lastUpdateTimestamp',
            type: 'uint40',
          },
          {
            internalType: 'address',
            name: 'aTokenAddress',
            type: 'address',
          },
          {
            internalType: 'address',
            name: 'stableDebtTokenAddress',
            type: 'address',
          },
          {
            internalType: 'address',
            name: 'variableDebtTokenAddress',
            type: 'address',
          },
          {
            internalType: 'address',
            name: 'interestRateStrategyAddress',
            type: 'address',
          },
          {
            internalType: 'uint256',
            name: 'availableLiquidity',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'totalPrincipalStableDebt',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'averageStableRate',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'stableDebtLastUpdateTimestamp',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'totalScaledVariableDebt',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'priceInMarketReferenceCurrency',
            type: 'uint256',
          },
          {
            internalType: 'address',
            name: 'priceOracle',
            type: 'address',
          },
          {
            internalType: 'uint256',
            name: 'variableRateSlope1',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'variableRateSlope2',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'stableRateSlope1',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'stableRateSlope2',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'baseStableBorrowRate',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'baseVariableBorrowRate',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'optimalUsageRatio',
            type: 'uint256',
          },
          { internalType: 'bool', name: 'isPaused', type: 'bool' },
          {
            internalType: 'bool',
            name: 'isSiloedBorrowing',
            type: 'bool',
          },
          {
            internalType: 'uint128',
            name: 'accruedToTreasury',
            type: 'uint128',
          },
          { internalType: 'uint128', name: 'unbacked', type: 'uint128' },
          {
            internalType: 'uint128',
            name: 'isolationModeTotalDebt',
            type: 'uint128',
          },
          {
            internalType: 'bool',
            name: 'flashLoanEnabled',
            type: 'bool',
          },
          {
            internalType: 'uint256',
            name: 'debtCeiling',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'debtCeilingDecimals',
            type: 'uint256',
          },
          {
            internalType: 'uint8',
            name: 'eModeCategoryId',
            type: 'uint8',
          },
          { internalType: 'uint256', name: 'borrowCap', type: 'uint256' },
          { internalType: 'uint256', name: 'supplyCap', type: 'uint256' },
          { internalType: 'uint16', name: 'eModeLtv', type: 'uint16' },
          {
            internalType: 'uint16',
            name: 'eModeLiquidationThreshold',
            type: 'uint16',
          },
          {
            internalType: 'uint16',
            name: 'eModeLiquidationBonus',
            type: 'uint16',
          },
          {
            internalType: 'address',
            name: 'eModePriceSource',
            type: 'address',
          },
          { internalType: 'string', name: 'eModeLabel', type: 'string' },
          {
            internalType: 'bool',
            name: 'borrowableInIsolation',
            type: 'bool',
          },
        ],
        internalType: 'struct AggregatedReserveData[]',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

(async () => {
  const ui = new Contract(ADDRESSES.uiPoolDataProvider, uiAbi, provider);
  const reserves = await ui.getReservesData(ADDRESSES.poolAddressesProvider);
  // Example: map symbol by joining with your own token list; here we just print rates.
  const SECONDS_PER_YEAR = 31536000n;
  for (const r of reserves) {
    // console.log(r);
    const apr = Number(r.variableBorrowRate) / 1e27;
    const apy = Math.pow(1 + apr / 31536000, 31536000) - 1;
    console.log(r.underlyingAsset, r.symbol, { apr, apy });
  }
})();
