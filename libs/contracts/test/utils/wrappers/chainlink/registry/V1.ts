import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import {
  FeedRegistry,
  HistoricDataFeedStoreV1,
} from '../../../../../typechain';
import { deployContract } from '../../../helpers/common';
import { ChainlinkRegistryBaseWrapper } from './Base';

export class ChainlinkRegistryV1Wrapper extends ChainlinkRegistryBaseWrapper<HistoricDataFeedStoreV1> {
  public override async init(owner: HardhatEthersSigner) {
    this.owner = owner;
    this.contract = await deployContract<FeedRegistry>(
      'FeedRegistry',
      owner.address,
    );
  }

  public override getName(): string {
    return 'ChainlinkRegistryV1';
  }
}
