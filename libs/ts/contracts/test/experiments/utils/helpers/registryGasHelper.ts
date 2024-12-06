import { RegistryWrapper } from '../../utils/wrappers';
import { logTable } from './common';

export const callAndCompareRegistries = async (
  registryWrappers: RegistryWrapper[],
  chainlinkRegistryWrappers: RegistryWrapper[],
  functionName: string,
  ...args: any[]
) => {
  const map: Record<string, string> = {};
  for (const wrapper of [...registryWrappers, ...chainlinkRegistryWrappers]) {
    map[wrapper.contract.target as string] = wrapper.getName();
  }

  const txs = await Promise.all(
    registryWrappers.map(wrapper => wrapper.call(functionName, ...args)),
  );

  let chainlinkTxs = [];
  for (const wrapper of chainlinkRegistryWrappers) {
    if (functionName === 'setRoundData') {
      const roundId = await wrapper.registry.latestRound(...args.slice(0, 2));
      chainlinkTxs.push(
        wrapper.call(functionName, ...args.slice(0, 2), roundId - 4n),
      );
    } else {
      chainlinkTxs.push(wrapper.call(functionName, ...args));
    }
  }

  chainlinkTxs = await Promise.all(chainlinkTxs);

  await logTable(map, txs, chainlinkTxs);
};
