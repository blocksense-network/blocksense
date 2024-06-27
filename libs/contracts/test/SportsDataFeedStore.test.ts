import { ethers, network } from 'hardhat';
import {
  IDataFeedStore__factory,
  SportsConsumer,
  SportsDataFeedStoreV1,
} from '../typechain';
import { expect } from 'chai';

const selector =
  IDataFeedStore__factory.createInterface().getFunction('setFeeds').selector;
const eventFragment = ethers.EventFragment.from({
  name: 'DataFeedSet',
  inputs: [
    {
      type: 'uint32',
      name: 'key',
    },
    {
      type: 'bytes32',
      name: 'description',
    },
  ],
});

describe.only('SportsDataFeedStore', () => {
  let sportsDataFeedStoreV1: SportsDataFeedStoreV1;
  let sportsConsumer: SportsConsumer;
  beforeEach(async () => {
    const SportsDataFeedStoreV1 = await ethers.getContractFactory(
      'SportsDataFeedStoreV1',
    );
    sportsDataFeedStoreV1 = await SportsDataFeedStoreV1.deploy();
    await sportsDataFeedStoreV1.waitForDeployment();

    const SportsConsumer = await ethers.getContractFactory('SportsConsumer');
    sportsConsumer = await SportsConsumer.deploy(sportsDataFeedStoreV1.target);
    await sportsConsumer.waitForDeployment();
  });

  it('Should set data correctly', async () => {
    const key1 = 1;
    const stringDescription1 = 'ABC/DEF';
    const description1 = ethers.encodeBytes32String(stringDescription1);
    const data1 = [1, 2, 3, 4, 5, 6, 7, 8];
    const data2 = [9, 10];
    const encodedData1 = encodeData(data1);
    const encodedData2 = encodeData(data2);
    const key2 = 3;
    const stringDescription2 = 'GHI/JKL';
    const description2 = ethers.encodeBytes32String(stringDescription2);
    const data3 = [11, 12, 13, 14, 15, 16];
    const encodedData3 = encodeData(data3);

    const txData = ethers.solidityPacked(
      [
        'bytes4',
        'uint32',
        'uint16',
        'bytes32',
        'bytes32',
        'bytes32',
        'uint32',
        'uint16',
        'bytes32',
        'bytes32',
      ],
      [
        selector,
        key1,
        2,
        encodedData1.padEnd(66, '0'),
        encodedData2.padEnd(66, '0'),
        description1,
        key2,
        1,
        encodedData3.padEnd(66, '0'),
        description2,
      ],
    );

    const txHash = await network.provider.send('eth_sendTransaction', [
      {
        to: sportsDataFeedStoreV1.target,
        data: txData,
      },
    ]);

    const receipt = await network.provider.send('eth_getTransactionReceipt', [
      txHash,
    ]);

    const parsedEvent1 = sportsDataFeedStoreV1.interface.decodeEventLog(
      eventFragment,
      receipt.logs[0].data,
    );
    const parsedEvent2 = sportsDataFeedStoreV1.interface.decodeEventLog(
      eventFragment,
      receipt.logs[1].data,
    );

    expect(parsedEvent1[0]).to.equal(key1);
    expect(ethers.decodeBytes32String(parsedEvent1[1])).to.equal(
      stringDescription1,
    );

    const decodedData = await sportsConsumer.decodeFootballData(key1);
    expect(decodedData).to.deep.equal(data1.concat(data2));

    expect(parsedEvent2[0]).to.equal(key2);
    expect(ethers.decodeBytes32String(parsedEvent2[1])).to.equal(
      stringDescription2,
    );

    const fetchedData1 = await network.provider.send('eth_call', [
      {
        to: sportsDataFeedStoreV1.target,
        data:
          '0x' +
          ((key1 | 0x80000000) >>> 0).toString(16).padStart(8, '0') +
          Number(2).toString(16).padStart(64, '0'),
      },
      'latest',
    ]);
    const fetchedData2 = await network.provider.send('eth_call', [
      {
        to: sportsDataFeedStoreV1.target,
        data:
          '0x' +
          ((key2 | 0x80000000) >>> 0).toString(16).padStart(8, '0') +
          Number(1).toString(16).padStart(64, '0'),
      },
      'latest',
    ]);

    expect(
      encodedData1.concat(encodedData2.slice(2)).padEnd(130, '0'),
    ).to.equal(fetchedData1);
    expect(encodedData3.padEnd(66, '0')).to.equal(fetchedData2);
  });
});

const encodeData = (data: number[]) => {
  return ethers.solidityPacked(
    data.map(() => 'uint32'),
    data,
  );
};
