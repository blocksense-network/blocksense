import { ethers } from 'hardhat';
import {
  CLAdapterWrapper,
  CLBaseWrapper,
  CLRegistryBaseWrapper,
  UpgradeableProxyADFSWrapper,
} from './utils/wrappers';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { TOKENS } from './experiments/utils/helpers/common';
import { encodeDataAndTimestamp } from './utils/helpers/common';

let clRegistry: CLRegistryBaseWrapper;
let clAdapters: CLBaseWrapper[] = [];

const data = [
  {
    description: 'ETH/USD',
    decimals: 8,
    id: 3,
    base: TOKENS.ETH,
    quote: TOKENS.USD,
  },
  {
    description: 'BTC/USD',
    decimals: 6,
    id: 132,
    base: TOKENS.BTC,
    quote: TOKENS.USD,
  },
];

describe('CLFeedRegistryAdapter', async () => {
  let admin: HardhatEthersSigner;
  let sequencer: HardhatEthersSigner;
  let accessControlAdmin: HardhatEthersSigner;
  let proxy: UpgradeableProxyADFSWrapper;
  let caller: HardhatEthersSigner;
  let registryOwner: HardhatEthersSigner;

  let sourceAccumulator: string = ethers.toBeHex(0, 32);

  beforeEach(async function () {
    admin = (await ethers.getSigners())[9];
    sequencer = (await ethers.getSigners())[10];
    accessControlAdmin = (await ethers.getSigners())[5];
    caller = (await ethers.getSigners())[6];
    registryOwner = (await ethers.getSigners())[11];
    clAdapters = [];

    sourceAccumulator = ethers.toBeHex(0, 32);

    proxy = new UpgradeableProxyADFSWrapper();
    await proxy.init(admin, accessControlAdmin);

    await proxy.implementation.accessControl.setAdminStates(
      accessControlAdmin,
      [sequencer.address],
      [true],
    );

    clRegistry = new CLRegistryBaseWrapper('CLRegistry', proxy.contract);
    await clRegistry.init(registryOwner);

    for (const d of data) {
      const adapter = new CLAdapterWrapper();
      await adapter.init(d.description, d.decimals, d.id, proxy);
      clAdapters.push(adapter);
    }

    await clRegistry.setFeeds(
      data.map((d, i) => {
        return {
          base: d.base,
          quote: d.quote,
          feed: clAdapters[i],
        };
      }),
    );
  });

  it('Should return the correct feed', async () => {
    for (const [index, d] of data.entries()) {
      await clRegistry.checkFeed(
        d.base,
        d.quote,
        clAdapters[index].contract.target as string,
      );
    }
  });

  it('Should return the correct description', async () => {
    for (const d of data) {
      await clRegistry.checkDescription(d.base, d.quote, d.description);
    }
  });

  it('Should return the correct decimals', async () => {
    for (const d of data) {
      await clRegistry.checkDecimals(d.base, d.quote, d.decimals);
    }
  });

  it('Should return the correct latest answer', async () => {
    const value = encodeDataAndTimestamp(3132);
    for (const clAdapter of clAdapters) {
      const res = await clAdapter.setFeed(
        sequencer,
        value,
        1n,
        sourceAccumulator,
      );
      sourceAccumulator = res.destinationAccumulator;

      await clAdapter.checkLatestAnswer(caller, value);
    }

    for (const d of data) {
      await clRegistry.checkLatestAnswer(caller, d.base, d.quote, value);
    }
  });

  it('Should return the correct latest round id', async () => {
    const value = encodeDataAndTimestamp(3132);

    for (const clAdapter of clAdapters) {
      const res = await clAdapter.setFeed(
        sequencer,
        value,
        1n,
        sourceAccumulator,
      );
      sourceAccumulator = res.destinationAccumulator;

      await clAdapter.checkLatestRoundId(caller, 1n);
    }

    for (const d of data) {
      clRegistry.checkLatestRound(caller, d.base, d.quote, 1n);
    }
  });

  it('Should return the correct latest round data', async () => {
    const value = encodeDataAndTimestamp(3132);

    for (const clAdapter of clAdapters) {
      const res = await clAdapter.setFeed(
        sequencer,
        value,
        1n,
        sourceAccumulator,
      );
      sourceAccumulator = res.destinationAccumulator;

      await clAdapter.checkLatestRoundData(caller, value, 1n);
    }

    for (const d of data) {
      await clRegistry.checkLatestRoundData(caller, d.base, d.quote, value, 1n);
    }
  });

  it('Should return the correct round data', async () => {
    const value = encodeDataAndTimestamp(3132);

    for (const clAdapter of clAdapters) {
      const res = await clAdapter.setFeed(
        sequencer,
        value,
        1n,
        sourceAccumulator,
      );
      sourceAccumulator = res.destinationAccumulator;

      await clAdapter.checkRoundData(caller, value, 1n);
    }

    for (const d of data) {
      await clRegistry.checkRoundData(caller, d.base, d.quote, value, 1n);
    }
  });
});
