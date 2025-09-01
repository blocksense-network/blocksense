import { ethers } from 'ethers';

// ABI fragment for Pool.getReserveData
const poolAbi = [
  'function getReserveData(address asset) view returns (tuple(' +
    'uint256 configuration,' +
    'uint128 liquidityIndex,' +
    'uint128 variableBorrowIndex,' +
    'uint128 currentLiquidityRate,' +
    'uint128 currentVariableBorrowRate,' +
    'uint128 currentStableBorrowRate,' +
    'uint40 lastUpdateTimestamp,' +
    'address aTokenAddress,' +
    'address stableDebtTokenAddress,' +
    'address variableDebtTokenAddress,' +
    'address interestRateStrategyAddress,' +
    'uint128 availableLiquidity' +
    '))',
];

async function main() {
  // 1. Provider (use Infura, Alchemy, or any mainnet RPC)
  const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');

  // 2. Aave V3 Pool contract (Ethereum mainnet)
  const poolAddress = '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2';

  // 3. ERC20 asset: USDC mainnet
  const usdcAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

  // 4. Instantiate contract
  const pool = new ethers.Contract(poolAddress, poolAbi, provider);

  // 5. Fetch reserve data
  const data = await pool.getReserveData(usdcAddress);

  // 6. Extract variable borrow rate (ray-scaled: 1e27)
  const ray = 1e27;
  const varBorrowRateRay = data.currentVariableBorrowRate;
  const apr = Number(varBorrowRateRay) / ray;

  console.log(
    `Current variable borrow APR for USDC: ${(apr * 100).toFixed(6)}%`,
  );
}

main().catch(console.error);
