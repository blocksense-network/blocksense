import assert from 'node:assert';
import Web3 from 'web3';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import {
  EthereumAddress,
  parseEthereumAddress,
} from '@blocksense/base-utils/evm';

async function getWeb3(
  providerUrl: string,
  account: string,
  privateKey: string,
): Promise<{ web3: Web3; account: EthereumAddress }> {
  try {
    if (!providerUrl || !account || !privateKey) {
      throw new Error('providerUrl, account, and privateKey are required.');
    }

    const normalizedPrivateKey = privateKey.startsWith('0x')
      ? privateKey
      : `0x${privateKey}`;

    const parsedAccount = parseEthereumAddress(account);
    const web3 = new Web3(providerUrl);

    if (!web3.currentProvider) {
      throw new Error(`Invalid providerUrl: ${providerUrl}`);
    }

    web3.eth.accounts.wallet.add(normalizedPrivateKey);

    const walletAccount = web3.eth.accounts.wallet[0];
    if (!walletAccount || !walletAccount.address) {
      throw new Error('Failed to retrieve the account from the Web3 wallet.');
    }

    const address = parseEthereumAddress(walletAccount.address);

    assert.equal(
      parsedAccount,
      address,
      `Provided private key does not match the expected account: '${parsedAccount}'`,
    );

    return { web3, account: parsedAccount };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(chalk.red(`Error in getWeb3: ${error.message}`));
    } else {
      throw new Error(chalk.red('Unknown error occurred in getWeb3.'));
    }
  }
}

const main = async (): Promise<void> => {
  const currentSequencerAddress = '0xd756119012CcabBC59910dE0ecEbE406B5b952bE';

  const argv = await yargs(hideBin(process.argv))
    .usage(
      'Usage: $0 --providerUrl <url> --privateKey <key> [--address <ethereum address>]',
    )
    .option('providerUrl', {
      alias: 'p',
      describe: 'Ethereum provider URL',
      type: 'string',
      demandOption: true,
    })
    .option('privateKey', {
      alias: 'k',
      describe: 'Private key for the Ethereum account',
      type: 'string',
      demandOption: true,
    })
    .option('address', {
      alias: 'a',
      describe: 'Ethereum address to fetch transactions for',
      type: 'string',
      default: currentSequencerAddress,
    })
    .help()
    .alias('help', 'h')
    .parse();

  const { providerUrl, privateKey, address: rawAddress } = argv;
  const address = parseEthereumAddress(rawAddress);

  console.log(
    chalk.cyan(
      `Using Ethereum address: ${address} (sequencer: ${
        address === currentSequencerAddress
      })\n`,
    ),
  );

  try {
    const { web3, account } = await getWeb3(providerUrl, address, privateKey);

    console.log(chalk.green('Successfully connected to Web3.'));

    const nextNonce = await web3.eth.getTransactionCount(account, 'latest');
    const chainID = await web3.eth.getChainId();

    console.log(chalk.blue(`Resetting nonce for account: '${account}'`));
    console.log(chalk.blue(`On chainID: '${chainID}'`));
    console.log(chalk.blue(`Latest nonce: ${nextNonce}`));

    const pendingTx = await web3.eth.getTransactionFromBlock(
      'pending',
      nextNonce,
    );
    if (!pendingTx) {
      throw new Error('No pending transaction found at the given nonce.');
    }

    console.log(chalk.yellow('Found pending transaction:'), pendingTx);

    let newGasPrice: string | undefined;
    let maxFeePerGas: string | undefined;
    let maxPriorityFeePerGas: string | undefined;

    if ('maxFeePerGas' in pendingTx && 'maxPriorityFeePerGas' in pendingTx) {
      if (
        pendingTx.maxFeePerGas === undefined ||
        pendingTx.maxPriorityFeePerGas === undefined
      ) {
        throw new Error('EIP-1559 transaction is missing required fee fields.');
      }

      maxFeePerGas = ((BigInt(pendingTx.maxFeePerGas) * 15n) / 10n).toString();
      maxPriorityFeePerGas = (
        (BigInt(pendingTx.maxPriorityFeePerGas) * 15n) /
        10n
      ).toString();
    } else if ('gasPrice' in pendingTx) {
      if (pendingTx.gasPrice === undefined) {
        throw new Error('Legacy transaction is missing gasPrice.');
      }

      newGasPrice = ((BigInt(pendingTx.gasPrice) * 15n) / 10n).toString();
    } else {
      throw new Error(
        'Could not determine gas price for the pending transaction.',
      );
    }

    console.log(
      chalk.magenta('Sending replacement transaction with higher priority...'),
    );
    const txData = {
      from: account,
      to: pendingTx.to ? parseEthereumAddress(pendingTx.to) : account,
      value: pendingTx.value || '0',
      data: pendingTx.input || '0x',
      nonce: nextNonce,
      gas: pendingTx.gas || 21000,
      gasPrice: newGasPrice,
      maxFeePerGas,
      maxPriorityFeePerGas,
    };

    console.log(chalk.magenta('Transaction data:'), txData);

    const tx = await web3.eth.sendTransaction(txData);

    console.log(chalk.green('Tx hash:'), tx.transactionHash);
    console.log(chalk.green('Transaction confirmed'));
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(`Error in main: ${error.message}`));
    } else {
      console.error(chalk.red('Unknown error occurred in main.'));
    }
  }
};

main().catch(err => {
  console.error(
    chalk.red('Unhandled error:'),
    err instanceof Error ? err.message : err,
  );
  process.exit(1);
});
