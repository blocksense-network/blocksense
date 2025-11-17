import fs from 'fs/promises';
import assert from 'node:assert';

import { Effect, Either, Option, Schema as S } from 'effect';
import { Command, Options } from '@effect/cli';
import { withAlias, withSchema } from '@effect/cli/Options';
import type { Web3Account } from 'web3';
import type Web3 from 'web3';

import { getEnvStringNotAssert } from '@blocksense/base-utils/env';
import type { EthereumAddress } from '@blocksense/base-utils/evm';
import {
  getOptionalRpcUrl,
  parseEthereumAddress,
} from '@blocksense/base-utils/evm';
import { color as c } from '@blocksense/base-utils/tty';
import { listEvmNetworks } from '@blocksense/config-types/read-write-config';

import {
  getChainId,
  getCurrentGasPrice,
  getNonce,
  getWeb3,
  signAndSendTransaction,
} from './utils';

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
      const rpcUrl = yield* (() => {
        if (Option.isSome(rpcUrlInput)) {
          return Effect.succeed(rpcUrlInput.value);
        }
        if (Option.isSome(network)) {
          return Effect.succeed(getOptionalRpcUrl(network.value));
        }
        return Effect.fail(new Error('Need one of --network or --rpc-url'));
      })();

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
      if (latestNonce === null || pendingNonce === null) {
        return;
      }
      console.log('pendingNonce:', pendingNonce);
      console.log('latestNonce:', latestNonce);

      const loopState = {
        counter: 5,
        latestNonce,
        shouldContinue: true,
      };

      yield* Effect.loop(loopState, {
        while: state => state.shouldContinue,
        step: state => state,
        discard: true,
        body: state =>
          Effect.gen(function* () {
            console.log('Blocks passed without a change:', state.counter);
            const currentNonce = yield* getNonce(account, web3, 'latest');
            if (currentNonce === null) {
              return;
            }
            console.log('currentNonce: ', currentNonce);

            if (currentNonce >= pendingNonce) {
              console.log(
                'All pending transactions passed, current nonce: ',
                currentNonce,
              );
              state.shouldContinue = false;
              return;
            }

            if (currentNonce > state.latestNonce) {
              state.latestNonce = currentNonce;
              console.log('latestNonce is now: ', state.latestNonce);
              state.counter = 0;
            } else {
              state.counter++;
              if (state.counter > 5) {
                yield* replaceTransaction(web3, signer);
                state.counter = 0;
              }
            }

            yield* Effect.sleep(500); // Poll every 1/2 second
          }),
      });
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
    if (!web3) {
      return yield* Effect.fail(new Error('Failed to create web3 instance.'));
    }
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
    if (nextNonce === null) {
      throw new Error(
        'Failed to fetch next nonce for replacement transaction.',
      );
    }
    const chainID = yield* getChainId(web3);
    if (chainID === null) {
      return yield* Effect.fail(new Error('Failed to get chainID'));
    }
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

    yield* Effect.loop(multiplier, {
      while: multiplier => multiplier <= 10,
      step: multiplier => multiplier + 0.3,
      discard: true,
      body: multiplier =>
        Effect.gen(function* () {
          const sendResult = yield* Effect.either(
            signAndSendTransaction(web3, signer, txData),
          );

          if (Either.isRight(sendResult)) {
            const receipt = sendResult.right;
            console.log(c`{green Tx hash:}`, receipt.transactionHash);
            console.log(c`{green Transaction confirmed}`);
            return;
          }

          const error = sendResult.left;
          if (error instanceof Error && error.message.includes('underpriced')) {
            // Ignore underpriced error and retry with higher gas price
          } else {
            console.error(
              c`{red Transaction failed at multiplier ${multiplier}:}`,
              error,
            );
          }

          multiplier += 0.3;

          console.log(
            c`{yellow Retrying with higher gas price (x${multiplier.toFixed(1)})...}`,
          );
          txData.gasPrice = Math.floor(
            Number(currentGasPrice) * multiplier,
          ).toString();
        }),
    });
    console.error(c`{red Maximum multiplier reached, aborting.}`);
  });
