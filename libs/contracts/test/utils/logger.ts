import { BaseContract } from 'ethers';

export const contractVersionLogger = (
  contractsData: {
    [key: string]: BaseContract;
  }[],
) => {
  const addresses: { [key: string]: string } = {};
  for (const contracts of contractsData) {
    for (const key in contracts) {
      addresses[contracts[key].target.toString().toLowerCase()] = key;
    }
  }

  return (
    contractAddress: string,
    msg: string,
    log: Function = console.log,
  ) => {
    contractAddress = contractAddress.toLowerCase();

    if (!addresses[contractAddress]) {
      throw new Error('Contract not found');
    }

    let logMsg = addresses[contractAddress];
    if (msg.length > 0) {
      logMsg = log(`[${addresses[contractAddress]}] ${msg}`);
    }
    return logMsg;
  };
};
