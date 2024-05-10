import { ethers } from 'hardhat';
import { logTable } from './utils/helpers/common';
import { ChainlinkV1Wrapper, ChainlinkV2Wrapper } from './utils/wrappers';
import { OracleWrapper } from './utils/wrappers';

describe('Gas usage comparison between Chainlink and Blocksense @fork', async function () {
  let oracleV1: OracleWrapper;
  let oracleV2: OracleWrapper;
  let chainlinkOracle: OracleWrapper;

  let proxyV1: ChainlinkV1Wrapper;
  let proxyV2: ChainlinkV2Wrapper;

  before(async function () {
    if (process.env.FORKING !== 'true') {
      this.skip();
    }

    const signer = (await ethers.getSigners())[5];
    const data = {
      description: 'ETH / USD',
      decimals: 8,
      key: 0,
      proxyData: signer,
    };

    proxyV1 = new ChainlinkV1Wrapper();
    await proxyV1.init(...Object.values(data));

    proxyV2 = new ChainlinkV2Wrapper();
    await proxyV2.init(...Object.values(data));

    const value = ethers.encodeBytes32String('312343354');
    await proxyV1.setFeed(value);
    await proxyV2.setFeed(value);

    const chainlinkProxy = await ethers.getContractAt(
      'IChainlinkAggregator',
      '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
    );
    oracleV1 = new OracleWrapper('Blocksense V1', proxyV1.contract);
    oracleV2 = new OracleWrapper('Blocksense V2', proxyV2.contract);
    chainlinkOracle = new OracleWrapper('Chainlink', chainlinkProxy);

    await oracleV1.init(await proxyV1.contract.getAddress());
    await oracleV2.init(await proxyV2.contract.getAddress());
    await chainlinkOracle.init(await chainlinkProxy.getAddress());
  });

  it('Should compare setDecimals', async () => {
    await callAndCompare(
      [oracleV1, oracleV2],
      [chainlinkOracle],
      'setDecimals',
    );
  });

  it('Should compare setDescription', async () => {
    await callAndCompare(
      [oracleV1, oracleV2],
      [chainlinkOracle],
      'setDescription',
    );
  });

  it('Should compare setLatestAnswer', async () => {
    await callAndCompare(
      [oracleV1, oracleV2],
      [chainlinkOracle],
      'setLatestAnswer',
    );
  });

  it('Should compare setLatestRoundData', async () => {
    await callAndCompare(
      [oracleV1, oracleV2],
      [chainlinkOracle],
      'setLatestRoundData',
    );
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

    await callAndCompare(
      [oracleV1, oracleV2],
      [chainlinkOracle],
      'setRoundData',
      3,
    );
  });
});

const callAndCompare = async (
  oracleWrappers: OracleWrapper[],
  chainlinkOracleWrappers: OracleWrapper[],
  functionName: string,
  ...args: any[]
) => {
  const map: Record<string, string> = {};
  for (const wrapper of [...oracleWrappers, ...chainlinkOracleWrappers]) {
    map[wrapper.contract.target as string] = wrapper.getName();
  }

  const txs = await Promise.all(
    oracleWrappers.map(wrapper => wrapper.call(functionName, ...args)),
  );

  const chainlinkTxs = await Promise.all(
    chainlinkOracleWrappers.map(wrapper => {
      if (args.length === 1) {
        return wrapper.call(functionName, '110680464442257326420');
      }
      return wrapper.call(functionName);
    }),
  );

  await logTable(map, txs, chainlinkTxs);
};
