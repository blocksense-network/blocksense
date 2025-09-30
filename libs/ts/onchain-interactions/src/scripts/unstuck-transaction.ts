import fs from 'fs/promises';
import assert from 'node:assert';

import Web3 from 'web3';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { getEnvStringNotAssert } from '@blocksense/base-utils/env';
import type { EthereumAddress } from '@blocksense/base-utils/evm';
import { parseEthereumAddress } from '@blocksense/base-utils/evm';
import { color as c } from '@blocksense/base-utils/tty';

async function getWeb3(
  providerUrl: string,
  account: string,
  privateKey: string,
): Promise<{
  web3: Web3;
  account: EthereumAddress;
  signer: {
    address: string;
    privateKey: string;
    signTransaction: (txData: any) => Promise<any>;
  };
}> {
  try {
    if (!providerUrl || !account || !privateKey) {
      throw new Error('providerUrl, account, and privateKey are required.');
    }

    const normalizedPrivateKey = privateKey.startsWith('0x')
      ? privateKey
      : `0x${privateKey}`;

    const parsedAccount = parseEthereumAddress(account);

    const web3 = new Web3(providerUrl);
    const accountFromKey =
      web3.eth.accounts.privateKeyToAccount(normalizedPrivateKey);

    assert.strictEqual(
      accountFromKey.address.toLowerCase(),
      parsedAccount.toLowerCase(),
      `Provided private key does not match the expected account: '${parsedAccount}'`,
    );

    web3.eth.accounts.wallet.add(accountFromKey);

    return { web3, account: parsedAccount, signer: accountFromKey };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(c`{red Error in getEthers: ${(error as Error).message}}`);
    } else {
      throw new Error(c`{red Unknown error occurred in getEthers.}`);
    }
  }
}

async function replaceTransaction(
  web3: Web3,
  signer: {
    address: string;
    privateKey: string;
    signTransaction: (txData: any) => Promise<any>;
  },
): Promise<void> {
  const account = signer.address;

  const nextNonce = await web3.eth.getTransactionCount(account, 'latest');
  const chainID = await web3.eth.getChainId();

  console.log(c`{blue Resetting nonce for account: '${account}'}`);
  console.log(c`{blue On chainID: '${chainID}'}`);
  console.log(c`{blue Latest nonce: ${nextNonce}}`);

  const currentGasPrice = await web3.eth.getGasPrice();
  let multiplier = 1.4;

  console.log(
    c`{magenta Sending replacement transaction with higher priority...}`,
  );

  const txData = {
    to: account,
    value: '0',
    data: '0x',
    nonce: nextNonce,
    gas: 21000,
    gasPrice: Math.floor(Number(currentGasPrice) * multiplier).toString(),
  };

  console.log(c`{magenta Transaction data:}`, txData);

  while (multiplier <= 10) {
    try {
      const signedTx = await web3.eth.accounts.signTransaction(
        txData,
        signer.privateKey,
      );
      const receipt = await web3.eth.sendSignedTransaction(
        signedTx.rawTransaction,
      );

      console.log(c`{green Tx hash:}`, receipt.transactionHash);
      console.log(c`{green Transaction confirmed}`);
      break;
    } catch (error) {
      if (error instanceof Error && error.message.includes('underpriced')) {
        // Ignore underpriced error and retry with higher gas price
      } else {
        console.error(
          c`{red Transaction failed at multiplier ${multiplier}:}`,
          error,
        );
      }

      multiplier += 0.3;
      if (multiplier > 10) {
        console.error(c`{red Maximum multiplier reached, aborting.}`);
        break;
      }

      console.log(
        c`{yellow Retrying with higher gas price (x${multiplier.toFixed(1)})...}`,
      );
      txData.gasPrice = Math.floor(
        Number(currentGasPrice) * multiplier,
      ).toString();
    }
  }
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const main = async (): Promise<void> => {
  const sequencerAddress = getEnvStringNotAssert('SEQUENCER_ADDRESS');
  const argv = await yargs(hideBin(process.argv))
    .usage(
      'Usage: $0 --providerUrl <url> --privateKeyPath <path> [--address <ethereum address>]',
    )
    .option('providerUrl', {
      alias: 'p',
      describe: 'Ethereum provider URL',
      type: 'string',
      demandOption: true,
    })
    .option('privateKeyPath', {
      alias: 'pkp',
      describe: 'Private key path for the Ethereum account',
      type: 'string',
      demandOption: true,
    })
    .option('address', {
      alias: 'a',
      describe: 'Ethereum address to fetch transactions for',
      type: 'string',
      default: sequencerAddress,
    })
    .help()
    .alias('help', 'h')
    .parse();

  const { address: rawAddress, privateKeyPath, providerUrl } = argv;
  const privateKey = (await fs.readFile(privateKeyPath, 'utf8')).replace(
    /(\r\n|\n|\r)/gm,
    '',
  );
  const address = parseEthereumAddress(rawAddress);

  console.log(
    c`{cyan Using Ethereum address: ${address} (sequencer: ${
      address === sequencerAddress
    })}\n`,
  );

  try {
    const { account, signer, web3 } = await getWeb3(
      providerUrl,
      address,
      privateKey,
    );

    console.log(c`{green Successfully connected to Web3.}`);

    const pendingNonce = await web3.eth.getTransactionCount(account, 'pending');
    let latestNonce = await web3.eth.getTransactionCount(account, 'latest');
    console.log('pendingNonce:', pendingNonce);
    console.log('latestNonce:', latestNonce);

    let counter = 5;
    while (true) {
      console.log('Blocks passed without a change:', counter);
      const currentNonce = await web3.eth.getTransactionCount(
        account,
        'latest',
      );
      console.log('currentNonce: ', currentNonce);
      if (currentNonce >= pendingNonce) {
        console.log(
          'All pending transactions passed, current nonce: ',
          currentNonce,
        );
        process.exit(0);
      }
      if (currentNonce > latestNonce) {
        latestNonce = currentNonce;
        console.log('latestNonce is now: ', latestNonce);
        counter = 0;
      } else {
        counter++;
        if (counter > 5) {
          await replaceTransaction(web3, signer);
          counter = 0;
        }
      }
      await delay(500); // Poll every 1/2 second
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(c`{red Error in main: ${(error as Error).message}}`);
    } else {
      console.error(c`{red Unknown error occurred in main.}`);
    }
  }
};

main().catch(err => {
  console.error(
    c`{red Unhandled error:}`,
    err instanceof Error ? err.message : err,
  );
  process.exit(1);
});
