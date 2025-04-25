import { CLAggregatorAdapter } from '../../../../typechain';
import { deployContract } from '../../../experiments/utils/helpers/common';
import { UpgradeableProxyADFSWrapper } from '../adfs/UpgradeableProxy';
import { UpgradeableProxyADFSBaseWrapper } from '../adfs/UpgradeableProxyBase';
import { CLBaseWrapper } from './Base';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

export class CLAdapterWrapper extends CLBaseWrapper {
  public override async init(
    description: string,
    decimals: number,
    id: number,
    proxyData:
      | UpgradeableProxyADFSBaseWrapper
      | {
          adminAddress: string;
          accessControlData: HardhatEthersSigner | string;
        },
  ) {
    let proxy;
    if (proxyData instanceof UpgradeableProxyADFSBaseWrapper) {
      proxy = proxyData;
    } else {
      proxy = new UpgradeableProxyADFSWrapper();
      await proxy.init(proxyData.adminAddress, proxyData.accessControlData);
    }

    this.contract = await deployContract<CLAggregatorAdapter>(
      'CLAggregatorAdapter',
      description,
      decimals,
      id,
      proxy.contract.target,
    );

    this.id = BigInt(id);
    this.proxy = proxy;
  }

  public override getName(): string {
    return 'CLAggregatorAdapterADFS';
  }
}
