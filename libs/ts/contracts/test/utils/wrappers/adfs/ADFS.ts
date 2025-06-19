import { ADFSBaseWrapper } from './ADFSBase';
import { deployContract } from '../../../experiments/utils/helpers/common';
import { AggregatedDataFeedStore } from '@blocksense/contracts/typechain';
import { AccessControlWrapper } from './AccessControl';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

export class ADFSWrapper extends ADFSBaseWrapper {
  public override async init(accessControlData: HardhatEthersSigner | string) {
    this.accessControl = new AccessControlWrapper();
    await this.accessControl.init(accessControlData);

    this.contract = await deployContract<AggregatedDataFeedStore>(
      'AggregatedDataFeedStore',
      this.accessControl.contract.target,
    );
  }

  public override getName(): string {
    return 'AggregatedDataFeedStore';
  }
}
