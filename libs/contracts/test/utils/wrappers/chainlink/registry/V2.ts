import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import {
  FeedRegistry,
  HistoricDataFeedStoreV2,
} from '../../../../../typechain';
import { deployContract } from '../../../helpers/common';
import { ChainlinkRegistryBaseWrapper } from './Base';

export class ChainlinkRegistryV2Wrapper extends ChainlinkRegistryBaseWrapper<HistoricDataFeedStoreV2> {
  public override async init(owner: HardhatEthersSigner) {
    this.owner = owner;
    this.contract = await deployContract<FeedRegistry>(
      'FeedRegistry',
      owner.address,
    );
  }

  public override getName(): string {
    return 'ChainlinkRegistryV2';
  }
}
