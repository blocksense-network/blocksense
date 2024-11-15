import { ethers } from 'hardhat';
import { Contract, Log, Signer, Wallet } from 'ethers';

import MorphoABI from '../abis/Morpho.json';

const fetchBlocksenseAndDeployOracle = async (signer: Signer) => {
  const upgradeableProxy = await ethers.getContractAt(
    'UpgradeableProxy',
    '0xeE5a4826068C5326a7f06fD6c7cBf816F096846c',
    signer,
  );
  const key = '43';
  const decimals = 8;

  console.log('Deploying Oracle...');
  const Oracle = await ethers.getContractFactory(
    'BlocksenseMorphoOracle',
    signer,
  );
  const oracle = await Oracle.deploy(upgradeableProxy.target, key, decimals);

  return oracle;
};

// Sepolia setup
// `yarn hardhat run ./scripts/deployMorpho.ts --network ethereum-sepolia`
(async () => {
  try {
    console.log('Deploying Morpho...');
    const morphoAddress = '0xd011EE229E7459ba1ddd22631eF7bF528d424A14';
    const provider = ethers.provider;
    const signer = new Wallet(process.env.SIGNER_PRIVATE_KEY!, provider);
    const morpho = new Contract(morphoAddress, MorphoABI, signer);
    console.log(await provider.getBalance(signer.address));

    // USDC
    const loanToken = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
    // WBTC
    const collateralToken = '0x92f3B59a79bFf5dc60c0d59eA13a44D082B2bdFC';
    const oracle = await fetchBlocksenseAndDeployOracle(signer);
    const irm = '0x8C5dDCD3F601c91D1BF51c8ec26066010ACAbA7c';
    const lltv = '860000000000000000';

    console.log('Creating market...');
    const tx = await morpho.connect(signer).getFunction('createMarket')([
      loanToken,
      collateralToken,
      oracle.target,
      irm,
      lltv,
    ]);
    console.log('Waiting for transaction to be mined...');
    const receipt = await tx.wait();
    console.log('Transaction mined.');

    const topicData = { CreateMarket: ['id'] };

    const topics = [
      '0xac4b2400f169220b0c0afdde7a0b32e775ba727ea1cb30b35f935cdaab8683ac',
    ];

    const events = receipt.logs.map((log: Log) => {
      try {
        const parsedLog = morpho.interface.parseLog(log)!;
        if (parsedLog && topics.includes(parsedLog.topic)) {
          const parsedLogData: any = {
            blockNumber: log.blockNumber,
          };
          if (parsedLog.name in topicData) {
            topicData[parsedLog.name as keyof typeof topicData].forEach(
              (field: string) => {
                parsedLogData[field] = parsedLog.args[field].toString();
              },
            );
          }
          return {
            [parsedLog.name]: parsedLogData,
          };
        }
      } catch (error) {
        console.log('error', error);
        if (log?.topics[0] === topics[0]) {
          console.log('log', log);
        }
      }
      return '';
    });

    console.log('events', events);
    const id = events[0]['CreateMarket'].id;

    console.log('market settings', await morpho.idToMarketParams(id));
    console.log('market', await morpho.market(id));

    process.exit(0);
  } catch (e: any) {
    console.log(e);
    process.exit(1);
  }
})();
