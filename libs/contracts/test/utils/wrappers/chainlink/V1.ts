import {
  ChainlinkProxyV1,
  HistoricDataFeedStoreV1,
  IChainlinkAggregator,
} from '../../../../typechain';
import { deployContract } from '../../helpers/common';
import { ChainlinkBaseWrapper } from './Base';
import { UpgradeableProxyHistoricDataFeedStoreV1Wrapper } from '../upgradeable/historic/V1';
import { UpgradeableProxyHistoricBaseWrapper } from '../upgradeable/historic/Base';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

export class ChainlinkV1Wrapper extends ChainlinkBaseWrapper<HistoricDataFeedStoreV1> {
  public override async init(
    description: string,
    decimals: number,
    key: number,
    proxyData:
      | UpgradeableProxyHistoricBaseWrapper<HistoricDataFeedStoreV1>
      | HardhatEthersSigner,
  ) {
    let proxy;
    if (proxyData instanceof HardhatEthersSigner) {
      proxy = new UpgradeableProxyHistoricDataFeedStoreV1Wrapper();
      await proxy.init(proxyData);
    } else {
      proxy = proxyData;
    }

    this.contract = (await deployContract<ChainlinkProxyV1>(
      'ChainlinkProxyV1',
      description,
      decimals,
      key,
      proxy.contract.target,
    )) as IChainlinkAggregator;

    this.key = key;
    this.proxy = proxy;
  }

  public override getName(): string {
    return 'ChainlinkProxyHistoricDataFeedStoreV1';
  }
}
