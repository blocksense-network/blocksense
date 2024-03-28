import { DataFeedStore } from './helpers';

export const contractVersionLogger = (contracts: {
  [key: string]: DataFeedStore;
}) => {
  const addresses: { [key: string]: string } = {};
  for (const key in contracts) {
    addresses[contracts[key].target.toString()] = key;
  }

  return (contract: DataFeedStore, msg: string, log: Function = console.log) =>
    log(`[${addresses[contract.target.toString()]}] ${msg}`);
};
