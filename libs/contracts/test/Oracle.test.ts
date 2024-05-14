import { ethers } from 'hardhat';
import { ChainlinkV1Wrapper, ChainlinkV2Wrapper } from './utils/wrappers';
import { OracleWrapper } from './utils/wrappers';
import { callAndCompareOracles } from './utils/helpers/oracleGasHelper';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';

describe('Gas usage comparison between Chainlink and Blocksense @fork', async function () {
  let oracles: OracleWrapper[];
  let chainlinkOracle: OracleWrapper;

  let proxyV1: ChainlinkV1Wrapper;
  let proxyV2: ChainlinkV2Wrapper;

  let data = {
    description: 'ETH / USD',
    decimals: 8,
    key: 15,
    proxyData: {} as HardhatEthersSigner,
  };

  before(async function () {
    if (process.env.FORKING !== 'true') {
      this.skip();
    }

    const signer = (await ethers.getSigners())[5];
    data.proxyData = signer;

    proxyV1 = new ChainlinkV1Wrapper();
    await proxyV1.init(
      data.description,
      data.decimals,
      data.key,
      data.proxyData,
    );

    proxyV2 = new ChainlinkV2Wrapper();
    await proxyV2.init(
      data.description,
      data.decimals,
      data.key,
      data.proxyData,
    );

    const value = ethers.encodeBytes32String('312343354');
    await proxyV1.setFeed(value);
    await proxyV2.setFeed(value);

    const chainlinkProxy = await ethers.getContractAt(
      'IChainlinkAggregator',
      '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
    );

    const oracleV1 = new OracleWrapper('Blocksense V1', [proxyV1.contract]);
    const oracleV2 = new OracleWrapper('Blocksense V2', [proxyV2.contract]);
    chainlinkOracle = new OracleWrapper('Chainlink', [chainlinkProxy]);

    await oracleV1.init(await proxyV1.contract.getAddress());
    await oracleV2.init(await proxyV2.contract.getAddress());
    await chainlinkOracle.init(await chainlinkProxy.getAddress());

    oracles = [oracleV1, oracleV2];
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
    });
  });

  describe('Chainlink vs Blocksense historic functions', async function () {
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
    });

    it('Should compare setRoundData', async () => {
      const value1 = ethers.encodeBytes32String('312343');
      await proxyV1.setFeed(value1);
      await proxyV2.setFeed(value1);

      const value2 = ethers.encodeBytes32String('1312343');
      await proxyV1.setFeed(value2);
      await proxyV2.setFeed(value2);

      const value3 = ethers.encodeBytes32String('13123433');
      await proxyV1.setFeed(value3);
      await proxyV2.setFeed(value3);

      const value4 = ethers.encodeBytes32String('13142343');
      await proxyV1.setFeed(value4);
      await proxyV2.setFeed(value4);

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
    });
  });
});
