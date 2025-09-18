import { ethers } from 'hardhat';
import { ADFSWrapper } from '@blocksense/contracts/utils/wrappers/adfs/ADFS';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { encodePackedData, encodeSSZData, TupleField } from '../src';
import { expect } from 'chai';

describe('Example: Sports Decoder', function () {
  let adfs: ADFSWrapper;
  let signers: HardhatEthersSigner[];
  let accessControlOwner: HardhatEthersSigner;
  let sequencer: HardhatEthersSigner;

  beforeEach(async () => {
    signers = await ethers.getSigners();
    sequencer = signers[0];
    accessControlOwner = signers[1];

    adfs = new ADFSWrapper();
    await adfs.init(accessControlOwner);
    await adfs.accessControl.setAdminStates(
      accessControlOwner,
      [sequencer.address],
      [true],
    );
  });

  const fields: TupleField = {
    name: 'SportsData',
    type: 'tuple',
    components: [
      { name: 'isOvertime', type: 'bool', size: 8 },
      { name: 'isFinal', type: 'bool', size: 8 },
      { name: 'homeScore', type: 'uint16', size: 16 },
      { name: 'awayScore', type: 'uint16', size: 16 },
      { name: 'homeTeamName', type: 'string' },
      { name: 'awayTeamName', type: 'string' },
      { name: 'homePlayers', type: 'string[6]' },
      { name: 'awayPlayers', type: 'string[6]' },
    ],
  };

  const values = [
    true,
    false,
    110,
    108,
    'TeamA',
    'TeamB',
    ['Player1', 'Player2', 'Player3', 'Player4', 'Player5', 'Player6'],
    ['PlayerA', 'PlayerB', 'PlayerC', 'PlayerD', 'PlayerE', 'PlayerF'],
  ];

  it('Should decode Encode Packed sports data', async () => {
    const epDecoder = await ethers.getContractFactory('ADFSSportsEPDecoder');
    const epDecoderInstance = await epDecoder.deploy(adfs.contract.target);

    const epData = encodePackedData(fields, values);
    const maxEPDataSlots = Math.ceil((epData.length - 2) / 64);
    const epStride = BigInt(Math.ceil(Math.log2(maxEPDataSlots)));

    await adfs.setFeeds(sequencer, [
      {
        id: 1n,
        stride: epStride,
        index: 0n,
        data: epData,
      },
    ]);

    const epResult = await epDecoderInstance.getLatestData(
      (epStride << 120n) | 1n,
    );
    expect(epResult).to.deep.equal(values);
  });

  it('Should decode SSZ sports data', async () => {
    const sszDecoder = await ethers.getContractFactory('ADFSSportsSSZDecoder');
    const sszDecoderInstance = await sszDecoder.deploy(adfs.contract.target);

    const sszData = await encodeSSZData(fields, values, 2);
    const maxSSZSlots = Math.ceil((sszData.length - 2) / 64);
    const sszStride = BigInt(Math.ceil(Math.log2(maxSSZSlots)));

    await adfs.setFeeds(sequencer, [
      {
        id: 1n,
        stride: sszStride,
        index: 0n,
        data: sszData,
      },
    ]);

    const sszResult = await sszDecoderInstance.getLatestData(
      (sszStride << 120n) | 1n,
    );
    expect(sszResult).to.deep.equal(values);
  });
});
