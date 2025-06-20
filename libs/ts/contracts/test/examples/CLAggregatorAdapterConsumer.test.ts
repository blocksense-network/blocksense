import { ethers } from 'hardhat';
import { expect } from 'chai';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

import { deployContract } from '../experiments/utils/helpers/common';
import { CLAggregatorAdapterConsumer } from '@blocksense/contracts/typechain';
import {
  CLAdapterWrapper,
  UpgradeableProxyADFSWrapper,
} from '../utils/wrappers';
import { encodeDataAndTimestamp } from '../utils/helpers/common';

describe('Example: CLAggregatorAdapterConsumer', function () {
  let clAggregatorAdapter: CLAdapterWrapper;
  let clAggregatorAdapterConsumer: CLAggregatorAdapterConsumer;
  let caller: HardhatEthersSigner;
  const latestAnswer = 1234;
  const timestamp = Date.now();
  const latestEncodedData = encodeDataAndTimestamp(latestAnswer, timestamp);

  beforeEach(async function () {
    const admin = (await ethers.getSigners())[9];
    const sequencer = (await ethers.getSigners())[10];
    const accessControlAdmin = (await ethers.getSigners())[5];
    caller = (await ethers.getSigners())[6];

    const proxy = new UpgradeableProxyADFSWrapper();
    await proxy.init(admin, accessControlAdmin);

    await proxy.implementation.accessControl.setAdminStates(
      accessControlAdmin,
      [sequencer.address],
      [true],
    );

    clAggregatorAdapter = new CLAdapterWrapper();
    await clAggregatorAdapter.init('ETH/USD', 8, 3, proxy);

    await clAggregatorAdapter.setFeed(sequencer, latestEncodedData, 1n);

    clAggregatorAdapterConsumer =
      await deployContract<CLAggregatorAdapterConsumer>(
        'CLAggregatorAdapterConsumer',
        clAggregatorAdapter.contract.target,
      );
  });

  it('Should compare results from adapter with those from adapter consumer', async function () {
    await clAggregatorAdapter.checkDecimals(
      Number(await clAggregatorAdapterConsumer.getDecimals()),
    );
    await clAggregatorAdapter.checkDescription(
      await clAggregatorAdapterConsumer.getDescription(),
    );
    expect(await clAggregatorAdapterConsumer.getLatestAnswer()).to.deep.equal(
      latestAnswer,
    );
    await clAggregatorAdapter.checkLatestAnswer(caller, latestEncodedData);
    await clAggregatorAdapter.checkLatestRoundId(
      caller,
      await clAggregatorAdapterConsumer.getLatestRound(),
    );
    expect(await clAggregatorAdapterConsumer.getRoundData(1)).to.deep.equal([
      /* roundId_: */ 1n,
      /* answer_: */ latestAnswer,
      /* startedAt_: */ BigInt(timestamp) / 1000n,
      /* updatedAt_: */ BigInt(timestamp) / 1000n,
      /* answeredInRound_: */ 1n,
    ]);
    await clAggregatorAdapter.checkLatestRoundData(
      caller,
      latestEncodedData,
      1n,
    );
  });
});
