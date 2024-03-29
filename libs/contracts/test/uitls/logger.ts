import { BaseContract } from 'ethers';

export const contractVersionLogger = (
  contractsData: {
    [key: string]: BaseContract;
  }[],
) => {
  const addresses: { [key: string]: string } = {};
  for (const contracts of contractsData) {
    for (const key in contracts) {
      addresses[contracts[key].target.toString()] = key;
    }
  }

  return (contract: BaseContract, msg: string, log: Function = console.log) =>
    log(`[${addresses[contract.target.toString()]}] ${msg}`);
};
