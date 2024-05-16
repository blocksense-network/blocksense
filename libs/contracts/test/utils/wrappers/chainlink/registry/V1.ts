import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import {
  FeedRegistry,
  FeedRegistryV1,
  HistoricDataFeedStoreV1,
} from '../../../../../typechain';
import { deployContract } from '../../../helpers/common';
import { ChainlinkRegistryBaseWrapper } from './Base';

export class ChainlinkRegistryV1Wrapper extends ChainlinkRegistryBaseWrapper<HistoricDataFeedStoreV1> {
  public override async init(owner: HardhatEthersSigner) {
    this.owner = owner;
    this.contract = (await deployContract<FeedRegistryV1>(
      'FeedRegistryV1',
      owner.address,
    )) as FeedRegistry;
  }

  public override getName(): string {
    return 'ChainlinkRegistryV1';
  }
}
