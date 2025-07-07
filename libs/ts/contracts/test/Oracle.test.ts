import { ethers } from 'hardhat';
import { CLV1Wrapper, CLV2Wrapper } from './experiments/utils/wrappers';
import { OracleWrapper } from './utils/wrappers';
import { callAndCompareOracles } from './utils/helpers/oracleGasHelper';
import { expect } from 'chai';
import {
  CLAdapterWrapper,
  UpgradeableProxyADFSWrapper,
} from './utils/wrappers';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { encodeData, encodeDataAndTimestamp } from './utils/helpers/common';

let oracles: OracleWrapper[];
let chainlinkOracle: OracleWrapper;

let proxyV1: CLV1Wrapper;
let proxyV2: CLV2Wrapper;
let clAdapter: CLAdapterWrapper;

let data = {
  description: 'ETH / USD',
  decimals: 8,
  id: 15,
};

describe('Gas usage comparison between Chainlink and Blocksense @fork', async function () {
  let admin: HardhatEthersSigner;
  let sequencer: HardhatEthersSigner;
  let accessControlAdmin: HardhatEthersSigner;
  let proxy: UpgradeableProxyADFSWrapper;
  let caller: HardhatEthersSigner;

  before(async function () {
    if (process.env['FORKING'] !== 'true') {
      this.skip();
    }

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

    clAdapter = new CLAdapterWrapper();
    await clAdapter.init(data.description, data.decimals, data.id, proxy);
    const value = encodeDataAndTimestamp(312343354, Date.now() - 1234);
    await clAdapter.setFeed(sequencer, value, 1n);

    const signer = (await ethers.getSigners())[5];

    proxyV1 = new CLV1Wrapper();
    await proxyV1.init(data.description, data.decimals, data.id, signer);

    proxyV2 = new CLV2Wrapper();
    await proxyV2.init(data.description, data.decimals, data.id, signer);

    await proxyV1.setFeed(value);
    await proxyV2.setFeed(value);

    const aggregator = await ethers.getContractAt(
      'IChainlinkAggregator',
      '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
    );

    const oracleV1 = new OracleWrapper('Blocksense V1', [proxyV1.contract]);
    const oracleV2 = new OracleWrapper('Blocksense V2', [proxyV2.contract]);
    const clAdapterOracle = new OracleWrapper('Blocksense Adapter', [
      clAdapter.contract,
    ]);
    chainlinkOracle = new OracleWrapper('Chainlink', [aggregator]);

    await oracleV1.init(await proxyV1.contract.getAddress());
    await oracleV2.init(await proxyV2.contract.getAddress());
    await clAdapterOracle.init(await clAdapter.contract.getAddress());
    await chainlinkOracle.init(await aggregator.getAddress());

    oracles = [oracleV1, oracleV2, clAdapterOracle];
  });

  describe('Chainlink vs Blocksense base functions', async function () {
    it('Should compare setDecimals', async () => {
      await callAndCompareOracles(oracles, [chainlinkOracle], 'setDecimals');

      const decimals = await Promise.all(
        oracles.map(oracle => oracle.contract.decimals()),
      );

      decimals.forEach(decimal => {
        expect(decimal).to.be.equal(data.decimals);
      });
      await proxyV1.checkDecimals(Number(decimals[0]));
      await proxyV2.checkDecimals(Number(decimals[0]));
      await clAdapter.checkDecimals(Number(decimals[0]));
    });

    it('Should compare setDescription', async () => {
      await callAndCompareOracles(oracles, [chainlinkOracle], 'setDescription');

      const descriptions = await Promise.all(
        oracles.map(oracle => oracle.contract.description()),
      );

      descriptions.forEach(description => {
        expect(description).to.be.equal(data.description);
      });

      await proxyV1.checkDescription(descriptions[0]);
      await proxyV2.checkDescription(descriptions[0]);
      await clAdapter.checkDescription(descriptions[0]);
    });

    it('Should compare setLatestAnswer', async () => {
      await callAndCompareOracles(
        oracles,
        [chainlinkOracle],
        'setLatestAnswer',
      );

      const answers = await Promise.all(
        oracles.map(oracle => oracle.contract.price()),
      );

      const answer = answers[0];
      answers.slice(1).forEach(a => {
        expect(a).to.be.equal(answer);
      });

      await proxyV1.checkLatestAnswer(answer);
      await proxyV2.checkLatestAnswer(answer);
      await clAdapter.checkLatestAnswer(caller, encodeData(answer));
    });

    it('Should compare setLatestRoundId', async () => {
      await callAndCompareOracles(
        oracles,
        [chainlinkOracle],
        'setLatestRoundId',
      );

      const roundIds = await Promise.all(
        oracles.map(oracle => oracle.contract.roundId()),
      );

      const roundId = Number(roundIds[0]);
      roundIds.slice(1).forEach(id => {
        expect(id).to.be.equal(roundId);
      });

      await proxyV1.checkLatestRoundId(roundId);
      await proxyV2.checkLatestRoundId(roundId);
      await clAdapter.checkLatestRoundId(caller, roundIds[0]);
    });
  });

  describe('Chainlink vs Blocksense historical functions', async function () {
    it('Should compare setLatestRoundData', async () => {
      await callAndCompareOracles(
        oracles,
        [chainlinkOracle],
        'setLatestRoundData',
      );

      const roundData = [];
      for (const oracle of oracles) {
        roundData.push({
          answer: await oracle.contract.price(),
          startedAt: Number(await oracle.contract.lastUpdate()),
          roundId: await oracle.contract.roundId(),
        });
      }

      const { answer, roundId } = roundData[0];
      roundData.slice(1).forEach(data => {
        expect(data.answer).to.be.equal(answer);
        expect(data.roundId).to.be.equal(roundId);
      });

      await proxyV1.checkLatestRoundData(roundData[0]);
      await proxyV2.checkLatestRoundData(roundData[1]);
      await clAdapter.checkLatestRoundData(
        caller,
        encodeDataAndTimestamp(roundData[2].answer, roundData[2].startedAt),
        roundId,
      );
    });

    it('Should compare setRoundData', async () => {
      const value1 = encodeData(312343);
      await proxyV1.setFeed(value1);
      await proxyV2.setFeed(value1);

      const clAdapterValue1 = encodeDataAndTimestamp(312343);
      await clAdapter.setFeed(sequencer, clAdapterValue1, 2n);

      const value2 = encodeData(1312343);
      await proxyV1.setFeed(value2);
      await proxyV2.setFeed(value2);

      const clAdapterValue2 = encodeDataAndTimestamp(1312343);
      await clAdapter.setFeed(sequencer, clAdapterValue2, 3n);

      const value3 = encodeData(13123433);
      await proxyV1.setFeed(value3);
      await proxyV2.setFeed(value3);

      const clAdapterValue3 = encodeDataAndTimestamp(13123433);
      await clAdapter.setFeed(sequencer, clAdapterValue3, 4n);

      const value4 = encodeData(13142343);
      await proxyV1.setFeed(value4);
      await proxyV2.setFeed(value4);

      const clAdapterValue4 = encodeDataAndTimestamp(13142343);
      await clAdapter.setFeed(sequencer, clAdapterValue4, 5n);

      await callAndCompareOracles(
        oracles,
        [chainlinkOracle],
        'setRoundData',
        3,
      );

      const roundData = [];
      for (const oracle of oracles) {
        roundData.push({
          answer: await oracle.contract.price(),
          startedAt: Number(await oracle.contract.lastUpdate()),
        });
      }

      const { answer } = roundData[0];
      roundData.slice(1).forEach(data => {
        expect(data.answer).to.be.equal(answer);
      });

      await proxyV1.checkRoundData(3, roundData[0]);
      await proxyV2.checkRoundData(3, roundData[1]);
      await clAdapter.checkRoundData(caller, clAdapterValue2, 3n);
    });
  });
});
