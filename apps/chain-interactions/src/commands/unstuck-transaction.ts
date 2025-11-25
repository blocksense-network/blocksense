import fs from 'fs/promises';
import assert from 'node:assert';

import { Effect, Either, Option, Schema as S } from 'effect';
import { Command, Options } from '@effect/cli';
import { withAlias, withSchema } from '@effect/cli/Options';
import type { Web3Account } from 'web3';
import type Web3 from 'web3';

import { getEnvStringNotAssert } from '@blocksense/base-utils/env';
import type { EthereumAddress } from '@blocksense/base-utils/evm';
import { parseEthereumAddress } from '@blocksense/base-utils/evm';
import { color as c } from '@blocksense/base-utils/tty';
import { listEvmNetworks } from '@blocksense/config-types/read-write-config';

import {
  getChainId,
  getCurrentGasPrice,
  getNonce,
  getRpcFromNetworkOrRpcUrl,
  getWeb3,
  signAndSendTransaction,
} from './utils';

// Use this with caution!

// Because we are sending empty transactions to remove the stuck ones,
// ring buffer data within transactions will not be written to the contract
// and the history of the feeds will be incomplete.
// This can be solved once the adfs-indexer is ready and we can get tx data from there.
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
      Options.text('rpc').pipe(withSchema(S.URL), withAlias('r')),
    ),
    privateKeyPath: Options.text('private-key-path').pipe(withAlias('pkp')),
  },
  ({ addressInput, network, privateKeyPath, rpcUrlInput }) =>
    Effect.gen(function* () {
      const rpcUrl = yield* getRpcFromNetworkOrRpcUrl(network, rpcUrlInput);
      console.log(c`{green Using RPC URL: ${rpcUrl}}`);

      const address = Option.getOrElse(addressInput, () =>
        getEnvStringNotAssert('SEQUENCER_ADDRESS'),
      );

      const { account, signer, web3 } = yield* createWeb3Account(
        rpcUrl,
        address,
        privateKeyPath,
      );

      console.log(c`{green Successfully connected to Web3.}`);

      const latestNonce = yield* getNonce(account, web3, 'latest');
      const pendingNonce = yield* getNonce(account, web3, 'pending');
      console.log('pendingNonce:', pendingNonce);
      console.log('latestNonce:', latestNonce);

      const loopState = {
        latestNonce,
        pendingNonce,
      };

      yield* Effect.loop(loopState, {
        while: state => state.latestNonce < state.pendingNonce,
        step: state => state,
        discard: true,
        body: state =>
          Effect.gen(function* () {
            yield* replaceTransaction(web3, signer);
            const currentNonce = yield* getNonce(account, web3, 'latest');
            state.pendingNonce = yield* getNonce(account, web3, 'pending');
            console.log(
              'After replacement - pendingNonce:',
              state.pendingNonce,
              'currentNonce:',
              currentNonce,
            );
            if (currentNonce > state.latestNonce) {
              console.log('latestNonce is now: ', currentNonce);
              state.latestNonce = currentNonce;
            }
          }).pipe(
            Effect.catchAll(error =>
              Effect.sync(() => {
                console.error(
                  `Error while trying to replace transaction: ${
                    error instanceof Error ? error.message : String(error)
                  }}`,
                );
              }),
            ),
          ),
      });
      console.log(
        'All pending transactions passed, current nonce: ',
        latestNonce,
      );
    }),
);

const createWeb3Account = (
  rpcUrl: URL | string,
  address: string,
  privateKeyPath: string,
): Effect.Effect<
  {
    web3: Web3;
    account: EthereumAddress;
    signer: Web3Account;
  },
  Error,
  never
> =>
  Effect.gen(function* () {
    let privateKey = yield* Effect.tryPromise(() =>
      fs.readFile(privateKeyPath, 'utf8'),
    );
    privateKey = privateKey.replace(/(\r\n|\n|\r)/gm, '');

    const normalizedPrivateKey = privateKey.startsWith('0x')
      ? privateKey
      : `0x${privateKey}`;

    const parsedAccount = parseEthereumAddress(address);
    const web3 = yield* getWeb3(rpcUrl);
    const accountFromKey =
      web3.eth.accounts.privateKeyToAccount(normalizedPrivateKey);
    assert.strictEqual(
      accountFromKey.address.toLowerCase(),
      parsedAccount.toLowerCase(),
      `Provided private key does not match the expected account: '${parsedAccount}'`,
    );

    web3.eth.accounts.wallet.add(accountFromKey);

    return { web3, account: parsedAccount, signer: accountFromKey };
  });

const replaceTransaction = (
  web3: Web3,
  signer: Web3Account,
): Effect.Effect<void, Error, never> =>
  Effect.gen(function* () {
    const account = signer.address;

    const nextNonce = yield* getNonce(
      parseEthereumAddress(account),
      web3,
      'pending',
    );
    const chainID = yield* getChainId(web3);
    console.log(c`{blue Resetting nonce for account: '${account}'}`);
    console.log(c`{blue On chainID: '${chainID}'}`);
    console.log(c`{blue Latest nonce: ${nextNonce}}`);

    const currentGasPrice = yield* getCurrentGasPrice(web3);
    const multiplier = 1.4;

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

    const attemptReplacement = (multiplier: number) =>
      Effect.flatMap(
        Effect.either(signAndSendTransaction(web3, signer, txData)),
        sendResult => {
          if (Either.isRight(sendResult)) {
            return Effect.sync(() => {
              console.log(
                c`{green Tx hash:}`,
                sendResult.right.transactionHash,
              );
              console.log(c`{green Transaction confirmed}`);
            });
          }

          return Effect.sync(() => {
            const error = sendResult.left;
            if (
              !(error instanceof Error) ||
              !error.message.includes('underpriced')
            ) {
              console.error(
                c`{red Transaction failed at multiplier ${multiplier}:}`,
                error,
              );
            }

            const nextMultiplier = multiplier + 0.3;
            console.log(
              c`{yellow Retrying with higher gas price (x${nextMultiplier.toFixed(1)})...}`,
            );
            txData.gasPrice = Math.floor(
              Number(currentGasPrice) * nextMultiplier,
            ).toString();
          });
        },
      );

    yield* Effect.loop(multiplier, {
      while: multiplier => multiplier <= 10,
      step: multiplier => multiplier + 0.3,
      discard: true,
      body: attemptReplacement,
    });
    console.error(c`{red Maximum multiplier reached, aborting.}`);
  });
