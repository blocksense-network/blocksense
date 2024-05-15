import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import {
  FeedRegistryV2,
  HistoricDataFeedStoreV2,
} from '../../../../../typechain';
import { deployContract } from '../../../helpers/common';
import { ChainlinkRegistryBaseWrapper } from './Base';

export class ChainlinkRegistryV2Wrapper extends ChainlinkRegistryBaseWrapper<HistoricDataFeedStoreV2> {
  public override async init(owner: HardhatEthersSigner) {
    this.owner = owner;
    this.contract = await deployContract<FeedRegistryV2>(
      'FeedRegistryV2',
      owner.address,
    );
  }

  public override getName(): string {
    return 'ChainlinkRegistryV2';
  }
}
