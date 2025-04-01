import { ethers } from 'hardhat';
import {
  CLAdapterWrapper,
  UpgradeableProxyADFSWrapper,
} from './utils/wrappers';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { encodeDataAndTimestamp } from './utils/helpers/common';

const aggregatorData = [
  {
    description: 'ETH/USDC',
    decimals: 8,
    id: 0,
  },
  {
    description: 'BTC/USDC',
    decimals: 6,
    id: 1,
  },
];

let contractWrappers: CLAdapterWrapper[];

describe('CLAggregatorAdapter', function () {
  let admin: HardhatEthersSigner;
  let sequencer: HardhatEthersSigner;
  let accessControlAdmin: HardhatEthersSigner;
  let proxy: UpgradeableProxyADFSWrapper;
  let caller: HardhatEthersSigner;

  beforeEach(async function () {
    contractWrappers = [];

    admin = (await ethers.getSigners())[9];
    sequencer = (await ethers.getSigners())[10];
    accessControlAdmin = (await ethers.getSigners())[5];
    caller = (await ethers.getSigners())[6];

    proxy = new UpgradeableProxyADFSWrapper();
    await proxy.init(admin, accessControlAdmin);

    await proxy.implementation.accessControl.setAdminStates(
      accessControlAdmin,
      [sequencer.address],
      [true],
    );

    for (const data of aggregatorData) {
      const newAdapter = new CLAdapterWrapper();
      await newAdapter.init(data.description, data.decimals, data.id, proxy);
      contractWrappers.push(newAdapter);
    }
  });

  it('Should check description', async function () {
    for (const [i, data] of aggregatorData.entries()) {
      await contractWrappers[i].checkDescription(data.description);
    }
  });

  it('Should check decimals', async function () {
    for (const [i, data] of aggregatorData.entries()) {
      await contractWrappers[i].checkDecimals(data.decimals);
    }
  });

  it('Should check id', async function () {
    for (const [i, data] of aggregatorData.entries()) {
      await contractWrappers[i].checkId(data.id);
    }
  });

  describe('Assert storage', function () {
    for (const [i, data] of aggregatorData.entries()) {
      it(`Should get latest answer for ${data.description}`, async function () {
        const data1 = encodeDataAndTimestamp(1234);
        await contractWrappers[i].setFeed(sequencer, data1, 1n);

        await contractWrappers[i].checkSetValue(caller, data1);
        await contractWrappers[i].checkLatestAnswer(caller, data1);

        const data2 = encodeDataAndTimestamp(2345);
        await contractWrappers[i].proxy.proxyCall('setFeeds', sequencer, [
          {
            id: BigInt(data.id),
            round: 2n,
            data: data2,
            stride: 0n,
          },
        ]);

        await contractWrappers[i].checkSetValue(caller, data2);
        await contractWrappers[i].checkLatestAnswer(caller, data2);
      });

      it(`Should get latest round id for ${data.description}`, async function () {
        const data1 = encodeDataAndTimestamp(1234);

        await contractWrappers[i].setFeed(sequencer, data1, 1n);

        await contractWrappers[i].checkSetValue(caller, data1);
        await contractWrappers[i].checkLatestRoundId(caller, 1n);

        const data2 = encodeDataAndTimestamp(2345);
        await contractWrappers[i].proxy.proxyCall('setFeeds', sequencer, [
          {
            id: BigInt(data.id),
            round: 2n,
            data: data2,
            stride: 0n,
          },
        ]);

        await contractWrappers[i].checkSetValue(caller, data2);
        await contractWrappers[i].checkLatestRoundId(caller, 2n);
      });

      it(`Should get latest round data for ${aggregatorData[i].description}`, async function () {
        const data1 = encodeDataAndTimestamp(1234);

        await contractWrappers[i].setFeed(sequencer, data1, 1n);

        await contractWrappers[i].checkSetValue(caller, data1);
        await contractWrappers[i].checkLatestRoundData(caller, data1, 1n);

        const data2 = encodeDataAndTimestamp(2345);
        await contractWrappers[i].proxy.proxyCall('setFeeds', sequencer, [
          {
            id: BigInt(data.id),
            round: 2n,
            data: data2,
            stride: 0n,
          },
        ]);

        await contractWrappers[i].checkSetValue(caller, data2);
        await contractWrappers[i].checkLatestRoundData(caller, data2, 2n);
      });

      it(`Should get historical data for ${aggregatorData[i].description}`, async function () {
        const data1 = encodeDataAndTimestamp(3132);
        const data2 = encodeDataAndTimestamp(2345);
        const data3 = encodeDataAndTimestamp(12348747364);

        await contractWrappers[i].setFeed(sequencer, data1, 1n, 1);
        await contractWrappers[i].setFeed(sequencer, data2, 2n, 2);

        await contractWrappers[i].checkSetValue(caller, data2);
        await contractWrappers[i].checkRoundData(caller, data1, 1n);

        await contractWrappers[i].checkRoundData(caller, data2, 2n);

        await contractWrappers[i].proxy.proxyCall('setFeeds', sequencer, [
          {
            id: BigInt(data.id),
            round: 3n,
            data: data3,
            stride: 0n,
          },
        ]);

        await contractWrappers[i].checkSetValue(caller, data3);
        await contractWrappers[i].checkRoundData(caller, data3, 3n);
      });
    }
  });
});
