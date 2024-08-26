import { Contract } from 'ethers';
import fs from 'fs/promises';
import { ethers, artifacts } from 'hardhat';

(async () => {
  const config = JSON.parse(
    await fs.readFile('./scripts/feeds_config.json', 'utf8'),
  );

  const pairs = config.feeds.map((d: any) => {
    return { name: d.description, id: d.id };
  });

  const deployed = JSON.parse(
    await fs.readFile('./deployments/deploymentV1.json', 'utf8'),
  );

  const deployedPairs = deployed['11155111'].contracts.ChainlinkProxy.map(
    (d: any) => {
      return { name: d.description, address: d.address };
    },
  );

  const signer = await ethers.provider.getSigner();
  for (const pair of deployedPairs) {
    const proxyAggregator = new Contract(
      pair.address,
      (await artifacts.readArtifact('ChainlinkProxy')).abi,
      signer,
    );
    const key = await proxyAggregator.key();
    const configPair = pairs.find((p: any) => p.name === pair.name);
    if (configPair.id !== Number(key)) {
      console.log('\n\npair name', pair.name);
      console.log('pair id', configPair.id);
      console.log('pair address', pair.address);
      console.log('pair key', key);
    }
  }
})();
