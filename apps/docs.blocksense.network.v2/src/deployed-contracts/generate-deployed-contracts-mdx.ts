import { parseNetworkName, selectDirectory } from '@blocksense/base-utils';

import {
  decodeChainlinkCompatibilityConfig,
  decodeDeploymentConfig,
  DeploymentConfig,
} from '@blocksense/config-types';

import { pagesContractsFolder } from '@/src/constants';
import { stringifyObject } from '@/src/utils';
import { updateMetaJsonFile } from '@/src/utils-fs';
import { CoreContract, ProxyContractData } from './types';

import CHAINLINK_COMPATIBILITY from '@blocksense/monorepo/chainlink_compatibility';
import CONTRACTS_DEPLOYMENT_CONFIG from '@blocksense/monorepo/evm_contracts_deployment_v1';

function getCoreContractsData(networksData: DeploymentConfig) {
  const parsedCoreContracts: CoreContract[] = [];

  Object.entries(networksData).forEach(([_networkName, networkData]) => {
    if (!networkData) return;
    if (_networkName === 'local') return;
    const networkName = parseNetworkName(_networkName);
    const coreContracts = networkData.contracts.coreContracts;

    Object.entries(coreContracts).forEach(([contractName, contractsData]) => {
      const existingContract = parsedCoreContracts.find(
        contract => contract.contract === contractName,
      );

      if (existingContract) {
        existingContract.networks.push(networkName);
      } else {
        parsedCoreContracts.push({
          contract: contractName,
          address: contractsData.address,
          networks: [networkName],
        });
      }
    });
  });
  return parsedCoreContracts;
}

function getProxyContractsContent(networksData: DeploymentConfig) {
  const { blocksenseFeedsCompatibility } = decodeChainlinkCompatibilityConfig(
    CHAINLINK_COMPATIBILITY,
  );
  const supportedNetworks: ProxyContractData[] = Object.entries(networksData)
    .map(([_networkName, networkData]) => {
      if (!networkData) return [];
      if (_networkName === 'local') return [];
      const networkName = parseNetworkName(_networkName);
      const { CLAggregatorAdapter } = networkData.contracts;

      return CLAggregatorAdapter.map(aggregator => {
        const compatibilityData = Object.entries(
          blocksenseFeedsCompatibility,
        ).find(
          ([_id, data]) => data.description === aggregator.description,
        )?.[1];

        if (!compatibilityData) {
          throw new Error(
            `No compatibility data found for ${aggregator.description}`,
          );
        }

        return {
          ...aggregator,
          id: compatibilityData.id,
          network: networkName,
          chainlink_proxy: Object.entries(
            compatibilityData.chainlink_compatibility.chainlink_aggregators,
          ).find(([network, _data]) => network === networkName)?.[1],
        };
      });
    })
    .flat();
  return supportedNetworks;
}

function generateDeployedContractsContent(
  networksData: DeploymentConfig,
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
  const networksData = decodeDeploymentConfig(CONTRACTS_DEPLOYMENT_CONFIG);

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
