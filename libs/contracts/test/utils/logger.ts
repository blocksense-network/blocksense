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

  return (contract: BaseContract, msg: string, log: Function = console.log) => {
    if (!addresses[contract.target.toString()]) {
      throw new Error('Contract not found');
    }
    let logMsg = addresses[contract.target.toString()];
    if (msg.length > 0) {
      logMsg = log(`[${addresses[contract.target.toString()]}] ${msg}`);
    }
    return logMsg;
  };
};
