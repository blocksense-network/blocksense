import { expect } from 'chai';
import { ethers } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { Feed, ReadOp } from './utils/wrappers/types';
import { ADFSGenericWrapper, ADFSWrapper } from './utils/wrappers';
import {
  HistoricalDataFeedStoreBaseWrapper,
  HistoricalDataFeedStoreGenericBaseWrapper,
  HistoricalDataFeedStoreGenericV1Wrapper,
  HistoricalDataFeedStoreV1Wrapper,
  HistoricalDataFeedStoreV2Wrapper,
} from './experiments/utils/wrappers';
import { initWrappers } from './experiments/utils/helpers/common';
import { compareGasUsed } from './utils/helpers/compareGasWithExperiments';
import { generateRandomFeeds } from './utils/helpers/common';
import {
  decodeADFSCalldata,
  ParsedCalldata,
} from '../lib/utils/calldata-decoder';

const feeds: Feed[] = [
  {
    id: 1n,
    index: 6n,
    stride: 1n,
    data: '0x12343267643573',
    slotsToRead: 1,
  },
  {
    id: 2n,
    index: 5n,
    stride: 0n,
    data: '0x2456',
  },
  {
    id: 3n,
    index: 4n,
    stride: 0n,
    data: '0x3678',
  },
  {
    id: 4n,
    index: 3n,
    stride: 0n,
    data: '0x4890',
  },
  {
    id: 5n,
    index: 2n,
    stride: 0n,
    data: '0x5abc',
  },
];

describe('AggregatedDataFeedStore', () => {
  let contract: ADFSWrapper;
  let signers: HardhatEthersSigner[];
  let accessControlOwner: HardhatEthersSigner;
  let sequencer: HardhatEthersSigner;

  beforeEach(async () => {
    signers = await ethers.getSigners();
    sequencer = signers[0];
    accessControlOwner = signers[1];

    contract = new ADFSWrapper();
    await contract.init(accessControlOwner);
    await contract.accessControl.setAdminStates(
      accessControlOwner,
      [sequencer.address],
      [true],
    );
  });

  it('Should emit event when data feeds updated', async () => {
    const blockNumber = 1234;
    const tx = await contract.setFeeds(sequencer, feeds, {
      blockNumber,
    });
    const receipt = await tx.wait();
    contract.checkEvent(receipt!, blockNumber);
  });

  it('Should get latest index', async () => {
    await contract.setFeeds(sequencer, feeds);
    await contract.checkLatestIndex(sequencer, feeds);
  });

  it('Should get latest single feed data', async () => {
    const stride0Feeds = feeds.filter(feed => feed.stride === 0n);
    await contract.setFeeds(sequencer, stride0Feeds);
    const res = await contract.getValues(sequencer, stride0Feeds, {
      operations: stride0Feeds.map(() => ReadOp.GetLatestSingleData),
    });

    for (const [i, feed] of stride0Feeds.entries()) {
      expect(res[i]).to.equal(contract.formatData(feed));
    }
  });

  it('Should get latest data', async () => {
    await contract.setFeeds(sequencer, feeds);
    await contract.checkLatestData(sequencer, feeds);
  });

  it('Should get historical feed at index', async () => {
    await contract.setFeeds(sequencer, feeds);

    const updatedFeeds = feeds.map(feed => {
      return {
        ...feed,
        index: feed.index + 1n,
        data: ethers.hexlify(ethers.randomBytes(feed.data.length)),
      };
    });

    await contract.setFeeds(sequencer, updatedFeeds);

    await contract.checkDataAtIndex(sequencer, feeds);
    await contract.checkDataAtIndex(sequencer, updatedFeeds);
  });

  it('Should get latest single feed and index after update', async () => {
    const stride0Feeds = feeds.filter(feed => feed.stride === 0n);
    await contract.setFeeds(sequencer, stride0Feeds);

    const updatedFeeds = stride0Feeds.map(feed => {
      return {
        ...feed,
        index: feed.index + 1n,
        data: ethers.hexlify(ethers.randomBytes(feed.data.length)),
      };
    });

    await contract.setFeeds(sequencer, updatedFeeds);
    const res = await contract.getValues(sequencer, stride0Feeds, {
      operations: stride0Feeds.map(() => ReadOp.GetLatestSingleDataAndIndex),
    });

    for (const [i, feed] of updatedFeeds.entries()) {
      expect(res[i]).to.equal(
        ethers
          .toBeHex(feed.index, 32)
          .concat(contract.formatData(feed).slice(2)),
      );
    }
  });

  it('Should get latest feed and index after update', async () => {
    await contract.setFeeds(sequencer, feeds);

    const updatedFeeds = feeds.map(feed => {
      return {
        ...feed,
        index: feed.index + 1n,
        data: ethers.hexlify(ethers.randomBytes(feed.data.length)),
      };
    });

    await contract.setFeeds(sequencer, updatedFeeds);
    await contract.checkLatestDataAndIndex(sequencer, updatedFeeds);
  });

  it('Should revert on write when not in access control', async () => {
    await expect(contract.setFeeds(signers[2], feeds)).to.be.reverted;
  });

  it('Should revert if blockNumber same as previous block', async () => {
    const blockNumber = 1;
    await contract.setFeeds(sequencer, feeds, { blockNumber });

    await expect(contract.setFeeds(sequencer, feeds, { blockNumber })).to.be
      .reverted;
  });

  it('Should revert if blockNumber lower than previous block', async () => {
    const blockNumber = 1;
    await contract.setFeeds(sequencer, feeds, { blockNumber });

    await expect(
      contract.setFeeds(sequencer, feeds, { blockNumber: blockNumber - 1 }),
    ).to.be.reverted;
  });

  it('[W] Should revert when stride is bigger than max stride (31)', async () => {
    await expect(
      contract.setFeeds(sequencer, [
        {
          id: 1n,
          index: 1n,
          stride: 31n,
          data: '0x12343267643573',
        },
      ]),
    ).to.not.be.reverted;

    await expect(
      contract.setFeeds(sequencer, [
        {
          id: 1n,
          index: 1n,
          stride: 32n,
          data: '0x12343267643573',
        },
      ]),
    ).to.be.reverted;
  });

  it('[R] Should revert when id is bigger than max id (2**115 - 1)', async () => {
    const feed: Feed = {
      id: 2n ** 115n - 1n,
      index: 1n,
      stride: 31n,
      data: '0x12343267643573',
      slotsToRead: 1,
    };
    await contract.setFeeds(sequencer, [feed]);
    await contract.checkLatestData(sequencer, [feed]);
    await contract.checkDataAtIndex(sequencer, [feed]);

    await expect(
      contract.getValues(sequencer, [
        {
          ...feed,
          id: feed.id + 1n,
        },
      ]),
    ).to.be.reverted;
    await expect(
      contract.getValues(
        sequencer,
        [
          {
            ...feed,
            id: feed.id + 1n,
          },
        ],
        { operations: [ReadOp.GetDataAtIndex] },
      ),
    ).to.be.reverted;
  });

  it('[R] Should revert when stride is bigger than max stride (31)', async () => {
    const feed: Feed = {
      id: 2n,
      index: 1n,
      stride: 31n,
      data: '0x12343267643573',
      slotsToRead: 1,
    };
    await contract.setFeeds(sequencer, [feed]);
    await contract.checkLatestData(sequencer, [feed]);
    await contract.checkDataAtIndex(sequencer, [feed]);

    await expect(
      contract.getValues(sequencer, [
        {
          ...feed,
          stride: 32n,
        },
      ]),
    ).to.be.reverted;
    await expect(
      contract.getValues(
        sequencer,
        [
          {
            ...feed,
            stride: 32n,
          },
        ],
        { operations: [ReadOp.GetDataAtIndex] },
      ),
    ).to.be.reverted;
  });

  it('[R] Should revert when index is bigger than max index (2**13 - 1)', async () => {
    const feed: Feed = {
      id: 1n,
      index: 2n ** 13n - 1n,
      stride: 31n,
      data: '0x12343267643573',
      slotsToRead: 1,
    };
    await contract.setFeeds(sequencer, [feed]);
    await contract.checkDataAtIndex(sequencer, [feed]);

    await expect(
      contract.getValues(
        sequencer,
        [
          {
            id: 1n,
            index: 2n ** 13n,
            stride: 31n,
            slotsToRead: 1,
          },
        ],
        {
          operations: [ReadOp.GetDataAtIndex],
        },
      ),
    ).to.be.reverted;
  });

  it('[R] Should revert when slots to read exceed feed space', async () => {
    const feed = {
      id: 5000000000000n,
      index: 2n ** 13n - 1n,
      stride: 3n,
      data: ethers.hexlify(ethers.randomBytes(32)),
      slotsToRead: 8,
    };
    await contract.setFeeds(sequencer, [feed]);
    await contract.checkLatestData(sequencer, [feed]);
    await contract.checkDataAtIndex(sequencer, [feed]);

    await expect(
      contract.getValues(
        sequencer,
        [
          {
            ...feed,
            slotsToRead: feed.slotsToRead + 1,
          },
        ],
        {
          operations: [ReadOp.GetDataAtIndex],
        },
      ),
    ).to.be.reverted;
    await expect(
      contract.getValues(
        sequencer,
        [
          {
            ...feed,
            slotsToRead: feed.slotsToRead + 1,
          },
        ],
        {
          operations: [ReadOp.GetLatestData],
        },
      ),
    ).to.be.reverted;
  });

  it('[W] Should revert when index is outside of stride space', async () => {
    // index is exceeded
    await expect(
      contract.setFeeds(sequencer, [
        {
          id: 2n ** 115n - 1n,
          index: 2n ** 13n,
          stride: 0n,
          data: '0x12343267643573',
        },
      ]),
    ).to.be.reverted;

    // id is exceeded
    await expect(
      contract.setFeeds(sequencer, [
        {
          id: 2n ** 115n,
          index: 2n,
          stride: 0n,
          data: '0x12343267643573',
        },
      ]),
    ).to.be.reverted;

    await expect(
      contract.setFeeds(sequencer, [
        {
          id: 2n ** 115n - 1n,
          index: 2n ** 13n - 1n,
          stride: 0n,
          data: ethers.hexlify(ethers.randomBytes(32)),
        },
      ]),
    ).to.not.be.reverted;

    // bytes to write exceeds stride space
    await expect(
      contract.setFeeds(sequencer, [
        {
          id: 2n ** 115n - 1n,
          index: 2n ** 13n - 1n,
          stride: 0n,
          data: ethers.hexlify(ethers.randomBytes(33)),
        },
      ]),
    ).to.be.reverted;
  });

  it('[W] Should revert when index table index is bigger than 2**116', async () => {
    const feed = {
      id: 2n ** 115n - 1n,
      index: 1n,
      stride: 31n,
      data: '0x12343267643573',
    };

    let data = contract.encodeDataWrite([feed]);

    const indexTableIndex = ethers.toBeHex(
      (2n ** 115n * feed.stride + feed.id) / 16n,
    );
    const maxindexTableIndex = ethers.toBeHex(2n ** 116n - 1n);
    data = data.replace(indexTableIndex.slice(2), maxindexTableIndex.slice(2));
    await expect(
      sequencer.sendTransaction({
        to: contract.contract.target,
        data,
      }),
    ).to.not.be.reverted;

    const overflowindexTableIndex = ethers.toBeHex(2n ** 116n);
    data = data.replace(
      maxindexTableIndex.slice(2),
      overflowindexTableIndex.slice(2),
    );

    // change blocknumber
    const newPrefix = contract.encodeDataWrite([]);
    data = data.replace(data.slice(2, 20), newPrefix.slice(2, 20));

    await expect(
      sequencer.sendTransaction({
        to: contract.contract.target,
        data,
      }),
    ).to.be.reverted;
  });

  it('Should read from contract multiple slots', async () => {
    const feeds = generateRandomFeeds(15);

    await contract.setFeeds(sequencer, feeds);
    await contract.checkLatestDataAndIndex(sequencer, feeds);
  });

  describe('Compare gas usage', function () {
    let contractWrappers: HistoricalDataFeedStoreBaseWrapper[] = [];
    let genericContractWrappers: HistoricalDataFeedStoreGenericBaseWrapper[] =
      [];

    let genericContract: ADFSGenericWrapper;

    beforeEach(async function () {
      contractWrappers = [];
      genericContractWrappers = [];

      await initWrappers(contractWrappers, [
        HistoricalDataFeedStoreV1Wrapper,
        HistoricalDataFeedStoreV2Wrapper,
      ]);

      await initWrappers(genericContractWrappers, [
        HistoricalDataFeedStoreGenericV1Wrapper,
      ]);

      genericContract = new ADFSGenericWrapper();
      await genericContract.init(accessControlOwner);
      await genericContract.accessControl.setAdminStates(
        accessControlOwner,
        [sequencer.address],
        [true],
      );

      contract = new ADFSWrapper();
      await contract.init(accessControlOwner);
      await contract.accessControl.setAdminStates(
        accessControlOwner,
        [sequencer.address],
        [true],
      );

      // store no data first time in ADFS to avoid first sstore of blocknumber
      await contract.setFeeds(sequencer, []);
      await genericContract.setFeeds(sequencer, []);
    });

    for (let i = 1; i <= 100; i *= 10) {
      it(`Should set ${i} data feeds consecutively`, async function () {
        await compareGasUsed(
          sequencer,
          genericContractWrappers,
          contractWrappers,
          [contract],
          [genericContract],
          i,
          {
            index: 1n,
          },
        );

        await compareGasUsed(
          sequencer,
          genericContractWrappers,
          contractWrappers,
          [contract],
          [genericContract],
          i,
          {
            index: 2n,
          },
        );
      });

      it(`Should set ${i} data feeds every 16 id`, async function () {
        await compareGasUsed(
          sequencer,
          genericContractWrappers,
          contractWrappers,
          [contract],
          [genericContract],
          i,
          {
            skip: 16,
            index: 1n,
          },
        );

        await compareGasUsed(
          sequencer,
          genericContractWrappers,
          contractWrappers,
          [contract],
          [genericContract],
          i,
          {
            skip: 16,
            index: 2n,
          },
        );
      });
    }
  });
});

describe('ADFS input parser', () => {
  let contract: ADFSWrapper;
  let sequencer: HardhatEthersSigner;

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    sequencer = signers[0];
    const accessControlOwner = signers[1];

    contract = new ADFSWrapper();
    await contract.init(accessControlOwner);
    await contract.accessControl.setAdminStates(
      accessControlOwner,
      [sequencer.address],
      [true],
    );
  });

  it('Should decode feeds correctly when rb index is wrong', async () => {
    const calldata =
      '0x0100000000d19814d000000046000304c46d0120000000000000000000000000000000000000000090b93de5000001995d089e7000030577c70120000000000000000000000000000000000000000005fd62e0000001995d089e70000306d58001200000000000000000000000000000000000000c30dd14daf0000001995d089e7000030bfeae0120000000000000000000000000000000000000000038ac1522000001995d089e7000030c6071012000000000000000000000000000000000000000001186dbfe000001995d089e7000030c81820120000000000000000000000000000000000000000011864d94000001995d089e7000030cc62001200000000000000000000000000000000000000a528fbd8fb3000001995d089e7000030d83650120000000000000000000000000000000000ebcfeb49f4dda3c000001995d089e7000030e1e34012000000000000000000000000000000000000000001d2122a0000001995d089e700003117e98012000000000000000000000000000000000000000000f3aeffb000001995d089e7000031200bb012000000000000000000000000000000000036ba79f3fb64dca000001995d089e7000031221dd0120000000000000000000000000000000003812775a93714058000001995d089e70000312641f012000000000000000000000000000000000381539f91b76ca50000001995d089e70000316860e01200000000000000000000000000000000000000000563e6cc5000001995d089e70000318403d012000000000000000000000000000000000015a9b021c9bcdd6000001995d089e700003187b2f012000000000000000000000000000000000015abcc896c5ff04000001995d089e70000318a5cb012000000000000000000000000000000000049d4aafe34214b6000001995d089e700003198c3d012000000000000000000000000000000000123bb42b4266f55c000001995d089e7000031b84520120000000000000000000000000000000000000000001dcfccf000001995d089e7000031bcab4012000000000000000000000000000000000226f37d197b5cdcc000001995d089e7000031e05830120000000000000000000000000000000000000000004be563b000001995d089e7000031eb0e1012000000000000000000000000000000000025a3b55a181c764000001995d089e7000031ed68e012000000000000000000000000000000000025a9054005dffd4000001995d089e70000322f9230120000000000000000000000000000000000000000001f1b82c000001995d089e70000324bc650120000000000000000000000000000000000000000008073660000001995d089e7000032565b101200000000000000000000000000000000000000000011c4d64000001995d089e70000329d09801200000000000000000000000000000000000cbfea142eaffc0000001995d089e7000032b33520120000000000000000000000000000000000ca2bf8d49187474000001995d089e7000032c31560120000000000000000000000000000000001ab7f5d69985cbf8000001995d089e7000032c629301200000000000000000000000000000000000d2766a541f435e000001995d089e7000032cbe5e01200000000000000000000000000000000000d287be989afa4a000001995d089e7000032d276f01200000000000000000000000000000000000000009d9df5d7a000001995d089e700003368351012000000000000000000000000000000000000b8663eeaeea16000001995d089e7000033ae31f0120000000000000000000000000000000000000000000d88186000001995d089e7000033b9cd601200000000000000000000000000000000001ea9cdb9e4882a0000001995d089e7000033d6ab50120000000000000000000000000000000000000000027fc1ae2000001995d089e7000033ee8e3012000000000000000000000000000000000000000000000c9c9000001995d089e70000341717901200000000000000000000000000000000000079ea5bbe90ee9000001995d089e70000342466b012000000000000000000000000000000000000000000018065e000001995d089e700003427d7a012000000000000000000000000000000000000000000018065e000001995d089e70000343c1690120000000000000000000000000000000000000000001044bab000001995d089e7000034484f9012000000000000000000000000000000000d620b1ddcf6b5188000001995d089e70000346280401200000000000000000000000000000000000b807d3575d8000000001995d089e70000347c5660120000000000000000000000000000000000496ab4dd338bd3e000001995d089e7000034806360120000000000000000000000000000000000000823d3075530d000001995d089e700003497b6101200000000000000000000000000000000000000000024d330c000001995d089e70000349d26e0120000000000000000000000000000000000298af6aa429436c000001995d089e70000349f08501200000000000000000000000000000000002983f54602c1d78000001995d089e7000034a5922012000000000000000000000000000000000000000000000158b000001995d089e7000034ac61301200000000000000000000000000000000000000000239d1c54000001995d089e7000034b0d790120000000000000000000000000000000000179878d9d533266000001995d089e7000034e4c5601200000000000000000000000000000000000000080df2bbc11000001995d089e7000034fdbe601200000000000000000000000000000000000000000010922ab000001995d089e7000035044e80120000000000000000000000000000000000000000004c4fbf8000001995d089e7000035a2d60012000000000000000000000000000000000239cf327fe46e554000001995d089e7000035ab38b01200000000000000000000000000000000000000000042862da000001995d089e70000431ce535b012000000000000000000000000000000000006153ba66965c2e000001995d089e70000431ce7374012000000000000000000000000000000000004fab75259de6d6000001995d089e70000431ce939001200000000000000000000000000000000000838bc7531cebdc000001995d089e70000431ceb3a60120000000000000000000000000000000000293a491e1b5c5e0000001995d089e70000431d47843012000000000000000000000000000000000014560e48543538a000001995d089e70000431d493540120000000000000000000000000000000000002bf8fcd3c8074000001995d089e70000431d4b36a01200000000000000000000000000000000000387fc1a25c1d9c000001995d089e70000431d4d372012000000000000000000000000000000000006a59b3c584e01f000001995d089e70000431d4f4b70120000000000000000000000000000000000191ea1453d4fe38000001995d089e70000431db1db6012000000000000000000000000000000000010f7566d142ed76000001995d089e70000431e0f23901200000000000000000000000000000000001560df0f0001694000001995d089e70000431e1124501200000000000000000000000000000000001518cf936ab1026000001995d089e70000431e74ab101200000000000000000000000000000000000241f7acca49d2a000001995d089e70000501e8488d9801200000000000000000000000000000000000000000001357ee000001995d089e7001020ff00e9d046f039519d611e7046d03fe1fe8202b21e117c704dc00001bcd1c3701031cd2224c031b04341b471c131580202a20b8201206ea14da1676150207281733010502b3028b031e000003b708f30a2809c71d001942055b20f702881b8002371eae01061acf1bbf1d302071218203c0062006e61cba1a681aca14c30365040304c71ce001071e341f26206c161b2182051808db083d1c042071206f20461d431d9a028c028c01080288055406130bf2027e0746036907521e3906841f931e98001100111eca1fb3010920bb21dd0324041f1a201b301c920839094707cf053c05b508e204a405ef05a0010b20122056042d0539060e09370aae039e13f915bd0f2610280de304df06ed0274010c1ef80497203d1b2f05c605cb06e60d3e0e251c8006a207720c3d1f080288165c010d0288084009090d0803da02c202881be71d9620b81d9d1e40045209f50ab40fc0010f05830d4c0683097010ff10e1168e1f75220c1a0e17fb18660000201e21fc109301110657063921b81978049f196c17171923224d02880ad80a5a166c16ee039c0856011208561c341c3600001c491c651bb808930b730c18055005b107482378218321b20114066906d20a85139c15d6146b15ee0ae50b47000002cc0345190710861098049101151b631aaa0288028804e104d805b20000125f13520bce1b481bae0000222a07980116109011560cf0229322591e5e217303c70000076f076f00001ee61fb800001865011b1e641e2b000003f6035115620571000006cd1a3a04621a470f9e0fb80b11055f011d02bf03c00474210821e021fa2266031f208e1ecd1ef11cd61cd600000e380f64011e00000dfb0ed60a190d690e7f031a1a8b1b280275095c0ab50fc213ee142604e6011f031102a30000046f05410000099808e30b5e137112f91013056d060a126522f5012022f5055e060a06ef0b5a0aae220a1b391ad20d0a0c7211791d071d0800000c5a01210ce908ac066b1d7a000009d71883000004ba1fe01fe0060d060621692169202101221f431dd21d570dbb04f905ea03860386217021b8077c220d038e221309de0ab9012304f9080408221ace1adb000002880288147414740c0b0ac500000566056600000124063605b112c203090308170722a409a208d21a2817251b61000011f6126e10850125028702871922189f028805af061300000d790ce4107610760d5c0d8820dd0c6d012709bf0a020c560a691cde1cde0d120a9507170737222b02e706971c621be60b3901280d3e162324e812ba00002214221800000216021619e21a301cc51b4000000952012d04f00d60042f073f06b4138b1404049d0da702870479128e127a199a000000000218e70000162f135b1374139013a600000000000000000000000000000000000000000218ea00000000000018431354136a137214b7000000000000000000000000000000000218ed000000000000000000001e011dd01e351db600000000000000000000000000000218f000000000000000000000000000001239124511d70000000000000000000000000218f30000000000000000000000000000000000000ab40ab10acb0ab70ab70000000002f42404d2000003830b8e0d980e6503e3013117ee0000000000000000000000000000';

    const { parsedCalldata, errors } = decodeADFSCalldata({ calldata });

    const feedIds = [
      38, 43, 54, 95, 99, 100, 102, 108, 112, 139, 144, 145, 147, 180, 194, 195,
      197, 204, 220, 222, 240, 245, 246, 279, 293, 299, 334, 345, 353, 355, 357,
      361, 436, 471, 476, 491, 503, 523, 530, 531, 542, 548, 561, 574, 576, 587,
      590, 591, 594, 598, 600, 626, 638, 642, 721, 725, 102002, 102003, 102004,
      102005, 102051, 102052, 102053, 102054, 102055, 102104, 102151, 102152,
      102202, 1000004,
    ];

    const feedsFound = feedIds.filter(feedId =>
      parsedCalldata.feeds.find(f => f.feedId === BigInt(feedId)),
    );
    expect(feedsFound.length).to.equal(
      feedIds.length,
      `Feeds found: ${feedsFound}`,
    );

    const feedsParsed = parsedCalldata.feeds.filter(feed =>
      feedIds.find(f => BigInt(f) === feed.feedId),
    );
    expect(feedsParsed.length).to.equal(
      feedIds.length,
      `Feeds not parsed: ${feedsParsed}`,
    );

    expect(errors).to.deep.equal([
      new Error('invalid ring buffer index 8305 for feedId 99'),
      new Error('invalid ring buffer index 8578 for feedId 100'),
      new Error('invalid ring buffer index 8379 for feedId 144'),
      new Error('invalid ring buffer index 8669 for feedId 145'),
      new Error('invalid ring buffer index 8253 for feedId 194'),
      new Error('invalid ring buffer index 8851 for feedId 355'),
      new Error('invalid ring buffer index 8553 for feedId 542'),
      new Error('invalid ring buffer index 9448 for feedId 642'),
    ]);
  });

  it('Should decode feeds from transaction data', async () => {
    const blockNumber = 1234;
    const receipt = await contract.setFeeds(sequencer, feeds, {
      blockNumber,
    });
    const calldata = receipt.data;
    const { parsedCalldata, errors } = decodeADFSCalldata({ calldata });

    expect(errors.length).to.equal(0);

    const expectedFeeds = feeds.map(feed => ({
      stride: feed.stride,
      feedIndex: (feed.id * 2n ** 13n + feed.index) * 2n ** feed.stride,
      feedId: feed.id,
      index: feed.index,
      data: feed.data,
    }));

    expect(parsedCalldata.blockNumber).to.equal(blockNumber);
    expect(parsedCalldata.sourceAccumulator).to.be.undefined;
    expect(parsedCalldata.destinationAccumulator).to.be.undefined;
    expect(parsedCalldata.feedsLength).to.equal(BigInt(feeds.length));
    expect(parsedCalldata.feeds).to.deep.equal(expectedFeeds);
  });

  it('Should decode ring buffer table from transaction data', async () => {
    const blockNumber = 1234;
    const receipt = await contract.setFeeds(sequencer, feeds, {
      blockNumber,
    });

    const { parsedCalldata, errors } = decodeADFSCalldata({
      calldata: receipt.data,
    });

    expect(errors.length).to.equal(0);

    const rowIndices = [
      ...new Set(feeds.map(feed => (2n ** 115n * feed.stride + feed.id) / 16n)),
    ].sort((a, b) => Number(a - b));

    const expectedRingBufferTable: ParsedCalldata['ringBufferTable'] = [];
    for (const rowIndex of rowIndices) {
      const slot = await sequencer.provider.getStorage(
        contract.contract.target,
        // RING_BUFFER_TABLE_ADDRESS
        BigInt('0x00000000fff00000000000000000000000000000') + rowIndex,
      );

      expectedRingBufferTable.push({
        index: BigInt(rowIndex),
        data: slot,
      });
    }

    expect(parsedCalldata.blockNumber).to.equal(blockNumber);
    expect(parsedCalldata.sourceAccumulator).to.be.undefined;
    expect(parsedCalldata.destinationAccumulator).to.be.undefined;
    expect(parsedCalldata.ringBufferTable).to.deep.equal(
      expectedRingBufferTable,
    );
  });

  // TODO: Add history accumulator tests when implemented
});
