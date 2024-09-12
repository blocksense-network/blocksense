import { selectDirectory } from '@blocksense/base-utils';

import { pagesContractsFolder } from '@/src/constants';
import { stringifyObject } from '@/src/utils';
import SUPPORTED_NETWORKS from '@/src/_mock/supported-networks-mock.json';
import { decodeSupportedNetworks, SupportedNetworks } from '@/src/_mock/types';
import { CoreContract } from './types';

function generateDeployedContractsContent(
  networksData: SupportedNetworks,
): string {
  const parsedCoreContracts: CoreContract[] = [];

  Object.entries(networksData).forEach(([_, networkData]) => {
    const networkName = networkData.name;
    const coreContracts = networkData.contracts.coreContracts;

    Object.entries(coreContracts).forEach(([contractName, contractAddress]) => {
      const existingContract = parsedCoreContracts.find(
        contract => contract.contract === contractName,
      );

      if (existingContract) {
        existingContract.networks.push(networkName);
      } else {
        parsedCoreContracts.push({
          contract: contractName,
          address: contractAddress,
          networks: [networkName],
        });
      }
    });
  });

  const deployedCoreContractsString = stringifyObject(parsedCoreContracts);

  const content = `
import { DeployedContracts } from '@/components/DeployedContracts/DeployedContracts';

<DeployedContracts deployedCoreContractsString={${deployedCoreContractsString}}/>
`;
  return content;
}

async function generateDeployedContractsFile() {
  const networksData = decodeSupportedNetworks(SUPPORTED_NETWORKS);

  const mdxFile = {
    name: 'deployed-contracts',
    content: generateDeployedContractsContent(networksData),
  };

  const { write, writeJSON, readJSON } = selectDirectory(pagesContractsFolder);
  let metaFileContent = await readJSON({ name: '_meta' });
  metaFileContent = {
    ...metaFileContent,
    'deployed-contracts': 'Deployed Contracts',
  };
  return Promise.all([
    write({ ext: '.mdx', ...mdxFile }),
    writeJSON({
      base: '_meta.json',
      content: metaFileContent,
    }),
  ]);
}

generateDeployedContractsFile()
  .then(() => console.log('Deployed Contracts Pages generated!'))
  .catch(err => {
    console.log(`DCP generation error: ${err}`);
  });
