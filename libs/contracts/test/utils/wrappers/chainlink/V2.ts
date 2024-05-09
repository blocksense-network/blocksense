import {
  ChainlinkProxy,
  HistoricDataFeedStoreV2,
  IChainlinkAggregator,
} from '../../../../typechain';
import { deployContract } from '../../helpers/common';
import { ChainlinkBaseWrapper } from './Base';
import { UpgradeableProxyHistoricDataFeedStoreV2Wrapper } from '../upgradeable/historic/V2';
import { UpgradeableProxyHistoricBaseWrapper } from '../upgradeable/historic/Base';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

export class ChainlinkV2Wrapper extends ChainlinkBaseWrapper<HistoricDataFeedStoreV2> {
  public override async init(
    ...args: [
      description: string,
      decimals: number,
      key: number,
      proxyData:
        | UpgradeableProxyHistoricBaseWrapper<HistoricDataFeedStoreV2>
        | HardhatEthersSigner,
    ]
  ) {
    const [description, decimals, key, proxyData] = args;

    let proxy;
    if (proxyData instanceof HardhatEthersSigner) {
      proxy = new UpgradeableProxyHistoricDataFeedStoreV2Wrapper();
      await proxy.init(proxyData);
    } else {
      proxy = proxyData;
    }

    this.contract = (await deployContract<ChainlinkProxy>(
      'ChainlinkProxy',
      description,
      decimals,
      key,
      proxy.contract.target,
    )) as IChainlinkAggregator;

    this.key = key;
    this.proxy = proxy;
  }

  public override getName(): string {
    return 'ChainlinkProxyHistoricDataFeedStoreV2';
  }
}
