import { selectDirectory } from '@blocksense/base-utils';

import DATA_FEEDS from '@blocksense/monorepo/feeds_config';
import { decodeFeedsConfig } from '@blocksense/config-types';

import { pagesContractsFolder } from '@/src/constants';
import { stringifyObject } from '@/src/utils';
import { updateMetaJsonFile } from '@/src/utils-fs';
import { decodeSupportedNetworks, SupportedNetworks } from '@/src/_mock/types';
import SUPPORTED_NETWORKS from '@/src/_mock/supported-networks-mock.json';
import { CoreContract, ProxyContractData } from './types';

function getCoreContractsData(networksData: SupportedNetworks) {
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
  return parsedCoreContracts;
}

function getProxyContractsContent(networksData: SupportedNetworks) {
  const { feeds: dataFeeds } = decodeFeedsConfig(DATA_FEEDS);

  const supportedNetworks: ProxyContractData[] = Object.entries(networksData)
    .map(([_, network]) => {
      const { name, contracts } = network;
      const { ChainlinkProxy } = contracts;

      return ChainlinkProxy.map(proxy => {
        return {
          ...proxy,
          id: dataFeeds.find(feed => feed.description === proxy.description)
            ?.id,
          network: name,
        };
      });
    })
    .flat();
  return supportedNetworks;
}

function generateDeployedContractsContent(
  networksData: SupportedNetworks,
): string {
  const parsedCoreContracts = getCoreContractsData(networksData);
  const parsedProxyContracts = getProxyContractsContent(networksData);

  const deployedCoreContractsString = stringifyObject(parsedCoreContracts);
  const deployedProxyContractsString = stringifyObject(parsedProxyContracts);

  const content = `
import { DeployedContracts } from '@/components/DeployedContracts/DeployedContracts';

<DeployedContracts
  deployedCoreContractsString={${deployedCoreContractsString}}
  deployedProxyContractsString={${deployedProxyContractsString}}/>
`;
  return content;
}

async function generateDeployedContractsFile() {
  const networksData = decodeSupportedNetworks(SUPPORTED_NETWORKS);

  const mdxFile = {
    name: 'deployed-contracts',
    content: generateDeployedContractsContent(networksData),
  };

  const { write } = selectDirectory(pagesContractsFolder);

  return Promise.all([
    write({ ext: '.mdx', ...mdxFile }),
    updateMetaJsonFile(pagesContractsFolder, {
      'deployed-contracts': 'Deployed Contracts',
    }),
  ]);
}

generateDeployedContractsFile()
  .then(() => console.log('Deployed Contracts Pages generated!'))
  .catch(err => {
    console.log(`DCP generation error: ${err}`);
  });
