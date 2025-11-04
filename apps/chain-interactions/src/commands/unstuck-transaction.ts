import fs from 'fs/promises';
import assert from 'node:assert';

import { Effect, Option, Schema as S } from 'effect';
import { Command, Options } from '@effect/cli';
import { withAlias, withSchema } from '@effect/cli/Options';
import Web3 from 'web3';

import { getEnvStringNotAssert } from '@blocksense/base-utils/env';
import type { EthereumAddress } from '@blocksense/base-utils/evm';
import {
  getOptionalRpcUrl,
  parseEthereumAddress,
} from '@blocksense/base-utils/evm';
import { color as c } from '@blocksense/base-utils/tty';
import { listEvmNetworks } from '@blocksense/config-types/read-write-config';

export const unstuckTransaction = Command.make(
  'unstuck-transaction',
  {
    addressInput: Options.optional(
      Options.text('address').pipe(withAlias('a')),
    ),
    network: Options.optional(
      Options.choice('network', await listEvmNetworks()).pipe(withAlias('n')),
    ),
    rpcUrlInput: Options.optional(
      Options.text('rpc-url').pipe(withSchema(S.URL), withAlias('r')),
    ),
    privateKeyPath: Options.text('private-key-path').pipe(withAlias('pkp')),
  },
  ({ addressInput, network, privateKeyPath, rpcUrlInput }) =>
    Effect.gen(function* () {
      if (!Option.isSome(network) || !Option.isSome(rpcUrlInput)) {
        console.error(c`{red Need one of --network or --rpc-url}`);
        return;
      }
      let rpcUrl;
      if (Option.isSome(rpcUrlInput)) {
        rpcUrl = rpcUrlInput.value;
      } else {
        rpcUrl = getOptionalRpcUrl(network.value);
      }

      let address;
      if (!Option.isSome(addressInput)) {
        address = getEnvStringNotAssert('SEQUENCER_ADDRESS');
      } else {
        address = addressInput.value;
      }
      let privateKey = yield* Effect.tryPromise({
        try: () => fs.readFile(privateKeyPath, 'utf8'),
        catch: e =>
          console.error(
            c`{red Failed to read private key file: }${privateKeyPath}\n${(e as Error).message}`,
          ),
      });
      privateKey = privateKey.replace(/(\r\n|\n|\r)/gm, '');

      const { account, signer, web3 } = yield* Effect.tryPromise(() =>
        getWeb3(rpcUrl, address, privateKey),
      );

      console.log(c`{green Successfully connected to Web3.}`);

      let latestNonce = yield* Effect.tryPromise({
        try: () => web3.eth.getTransactionCount(account, 'latest'),
        catch: e =>
          console.error(
            c`{red Failed to get latest nonce for account ${account} (RPC: ${rpcUrl})}`,
            (e as Error).message,
          ),
      });

      const pendingNonce = yield* Effect.tryPromise({
        try: () => web3.eth.getTransactionCount(account, 'pending'),
        catch: e =>
          console.error(
            c`{red Failed to get pending nonce for account ${account} (RPC: ${rpcUrl})}`,
            (e as Error).message,
          ),
      });

      console.log('pendingNonce:', pendingNonce);
      console.log('latestNonce:', latestNonce);

      let counter = 5;
      while (true) {
        console.log('Blocks passed without a change:', counter);
        const currentNonce = yield* Effect.tryPromise({
          try: () => web3.eth.getTransactionCount(account, 'latest'),
          catch: e =>
            console.error(
              c`{red Failed to get current nonce for account ${account} (RPC: ${rpcUrl})}`,
              (e as Error).message,
            ),
        });
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
            yield* Effect.tryPromise({
              try: () => replaceTransaction(web3, signer),
              catch: e =>
                console.error(
                  c`{red Failed to get current nonce for account ${account} (RPC: ${rpcUrl})}`,
                  (e as Error).message,
                ),
            });
            counter = 0;
          }
        }
        yield* Effect.tryPromise(() => delay(500)); // Poll every 1/2 second
      }
    }),
);

async function getWeb3(
  rpcUrl: string | URL,
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
    if (!rpcUrl || !account || !privateKey) {
      throw new Error('rpcUrl, account, and privateKey are required.');
    }

    const normalizedPrivateKey = privateKey.startsWith('0x')
      ? privateKey
      : `0x${privateKey}`;

    const parsedAccount = parseEthereumAddress(account);
    const web3 = new Web3(String(rpcUrl));
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
