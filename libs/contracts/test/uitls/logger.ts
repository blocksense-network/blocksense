import { DataFeedStore } from '.';

export const contractVersionLogger = (contracts: {
  [key: string]: DataFeedStore;
}) => {
  const addresses: { [key: string]: string } = {};
  for (const key in contracts) {
    addresses[contracts[key].target.toString()] = key;
  }

  return (contract: DataFeedStore, msg: string) =>
    console.log(`[${addresses[contract.target.toString()]}] ${msg}`);
};
