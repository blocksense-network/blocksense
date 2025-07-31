import * as readline from 'readline';

import * as S from 'effect/Schema';

import { ethereumAddress, hexDataString } from '@blocksense/base-utils';
import { safeContractName } from '@blocksense/config-types/safe';
import { Either } from 'effect';

// parse line like:
// deploying "SimulateTxAccessor" (tx: 0x2b084bfe586d2d00c52b9c3f2a73c3e441aefb98f29b6c0c03dfb6ee3236750c)...: deployed at 0xC6d7F179BB3b8252e30edB5c317637071df0adBE with 282175 gas

const logLineSchema = S.TemplateLiteralParser(
  S.Literal('deploying "'),
  safeContractName,
  S.Literal('" (tx: '),
  hexDataString,
  S.Literal(')...: deployed at '),
  ethereumAddress,
  S.Literal(' with '),
  S.Number,
  S.Literal(' gas'),
);

async function main() {
  if (process.stdin.isTTY) {
    console.log(
      'Please paste your deployment logs. Press Ctrl+D when you are finished.',
    );
  }

  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });

  const safeContracts = {} as SafeContracts;

  for await (const line of rl) {
    const either = S.decodeEither(logLineSchema)(line);
    if (Either.isLeft(either)) {
      console.error('Failed to parse line:', line);
      console.error(either.left.message);
      continue;
    }

    const contractName = either.right[1];
    const contractAddress = either.right[4];

    safeContracts[contractName] = contractAddress;
  }
}

await main();
