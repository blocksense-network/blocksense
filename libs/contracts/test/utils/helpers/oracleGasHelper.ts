import { OracleWrapper } from '../wrappers';
import { logTable } from './common';

export const callAndCompareOracles = async (
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

  let chainlinkTxs = [];

  for (const wrapper of chainlinkOracleWrappers) {
    if (args.length === 1) {
      const res = await wrapper.underlier.latestRoundData();
      chainlinkTxs.push(wrapper.call(functionName, res.roundId - 4n));
    } else {
      chainlinkTxs.push(wrapper.call(functionName));
    }
  }

  chainlinkTxs = await Promise.all(chainlinkTxs);

  await logTable(map, txs, chainlinkTxs);
};
