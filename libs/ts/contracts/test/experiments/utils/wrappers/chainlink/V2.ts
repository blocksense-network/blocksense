import {
  CLAggregatorAdapterExp,
  HistoricalDataFeedStoreV2,
} from '@blocksense/contracts/typechain';
import { deployContract } from '../../helpers/common';
import { CLBaseWrapper } from './Base';
import { UpgradeableProxyHistoricalDataFeedStoreV2Wrapper } from '../upgradeable/historical/V2';
import { UpgradeableProxyHistoricalBaseWrapper } from '../upgradeable/historical/Base';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

export class CLV2Wrapper extends CLBaseWrapper<HistoricalDataFeedStoreV2> {
  public override async init(
    description: string,
    decimals: number,
    key: number,
    proxyData:
      | UpgradeableProxyHistoricalBaseWrapper<HistoricalDataFeedStoreV2>
      | HardhatEthersSigner,
  ) {
    let proxy;
    if (proxyData instanceof HardhatEthersSigner) {
      proxy = new UpgradeableProxyHistoricalDataFeedStoreV2Wrapper();
      await proxy.init(proxyData);
    } else {
      proxy = proxyData;
    }

    this.contract = await deployContract<CLAggregatorAdapterExp>(
      'CLAggregatorAdapterExp',
      description,
      decimals,
      key,
      proxy.contract.target,
    );

    this.key = key;
    this.proxy = proxy;
  }

  public override getName(): string {
    return 'CLAggregatorAdapterExpHistoricalDataFeedStoreV2';
  }
}
