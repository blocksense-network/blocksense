import { parseEthereumAddress } from '@blocksense/base-utils/evm';
import { rootDir } from '@blocksense/base-utils/env';

import { Command } from '@effect/cli';
import { Effect, Console } from 'effect';
import { FileSystem } from '@effect/platform';
import * as readline from 'node:readline';

// Helper function for readline prompts that handle pasting better
const askQuestion = (question: string) =>
  Effect.tryPromise({
    try: async () => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await new Promise<string>(resolve => {
        rl.question(question + ' ', resolve);
      });

      rl.close();
      return answer.trim();
    },
    catch: error => new Error(`Failed to read input: ${error}`),
  });

export const addDeploymentConfig = Command.make(
  'add-deployment-config',
  {},
  () =>
    Effect.gen(function* () {
      // Prompt for network name
      const networkName = yield* askQuestion(
        'What is the network name? (e.g., Ethereum, Polygon, BSC)',
      );

      // Prompt for network ID with number validation
      const networkId = yield* Effect.gen(function* () {
        while (true) {
          const id = yield* askQuestion(
            'What is the network ID? (e.g., 1, 137, 56)',
          );

          const numericId = parseInt(id, 10);
          if (isNaN(numericId) || numericId <= 0) {
            yield* Console.log('⚠️  Network ID must be a positive number');
            continue;
          }

          yield* Console.log(`✓ Valid network ID: ${numericId}`);
          return numericId;
        }
      });

      // Prompt for network RPC with URL validation
      const networkRpc = yield* Effect.gen(function* () {
        while (true) {
          const rpcInput = yield* askQuestion(
            'What is the network RPC URL? (e.g., https://mainnet.infura.io/v3/...)',
          );

          try {
            new URL(rpcInput);
            yield* Console.log('✓ Valid RPC URL');
            return rpcInput;
          } catch (_error) {
            yield* Console.log(
              '⚠️  Invalid URL format. Please provide a valid HTTP/HTTPS URL.',
            );
            continue;
          }
        }
      });

      // Additional prompts for .env values with address validation
      const deployerAddress = yield* Effect.gen(function* () {
        while (true) {
          const addressInput = yield* askQuestion(
            'What is the deployer address? (This should be unique for deployment operations)',
          );

          try {
            const validatedAddress = parseEthereumAddress(addressInput);
            yield* Console.log('✓ Valid deployer address');
            return validatedAddress;
          } catch (_error) {
            yield* Console.log(
              '⚠️  Invalid Ethereum address format. Please try again.',
            );
            continue;
          }
        }
      });

      const deployerPrivateKey = yield* askQuestion(
        'What is the deployer private key? (Keep this secure and different from other keys)',
      );

      // Use deployer address as admin multisig owner automatically
      const adminMultisigOwner = deployerAddress;
      yield* Console.log(
        `✓ Admin multisig owner set to deployer address: ${adminMultisigOwner}`,
      );

      // Sequencer address with uniqueness check
      const sequencerAddress = yield* Effect.gen(function* () {
        while (true) {
          const addressInput = yield* askQuestion(
            'What is the sequencer address? (Must be different from deployer)',
          );

          try {
            const validatedSequencer = parseEthereumAddress(addressInput);

            // Check if it's the same as deployer
            if (
              validatedSequencer.toLowerCase() === deployerAddress.toLowerCase()
            ) {
              yield* Console.log(
                '❌ Error: Sequencer address cannot be the same as the deployer address. Please provide a different address.',
              );
              continue;
            }

            yield* Console.log('✓ Valid and unique sequencer address');
            return validatedSequencer;
          } catch (_error) {
            yield* Console.log(
              '⚠️  Invalid Ethereum address format. Please try again.',
            );
            continue;
          }
        }
      });

      // Convert network name to uppercase for env variable naming
      const networkNameUpper = networkName.toUpperCase();

      // Generate the .env format output
      const envOutput = `
# ${networkName} network / deployment config
NETWORKS="${networkName}"
RPC_URL_${networkNameUpper}="${networkRpc}"

# ---------------------
DEPLOYER_ADDRESS_IS_LEDGER_${networkNameUpper}="false"
DEPLOYER_ADDRESS_${networkNameUpper}="${deployerAddress}"
DEPLOYER_PRIVATE_KEY_${networkNameUpper}='${deployerPrivateKey}'

ADMIN_MULTISIG_THRESHOLD_${networkNameUpper}="1"
ADMIN_MULTISIG_OWNERS_${networkNameUpper}="${adminMultisigOwner}"

SEQUENCER_ADDRESS_${networkNameUpper}="${sequencerAddress}"
REPORTER_MULTISIG_ENABLE_${networkNameUpper}="false"
REPORTER_MULTISIG_THRESHOLD_${networkNameUpper}="1"
REPORTER_MULTISIG_SIGNERS_${networkNameUpper}="${sequencerAddress}"

FEED_IDS_${networkNameUpper}="all"
IS_SAFE_ORIGINAL_DEPLOYMENT_SOMNIA_MAINNET=false
`;

      // Handle .env file - append if exists, create if not
      const fs = yield* FileSystem.FileSystem;
      const envPath = `${rootDir}/.env`;

      // Check if file exists and has content
      const fileExists = yield* Effect.try(() => fs.exists(envPath)).pipe(
        Effect.catchAll(() => Effect.succeed(false)),
      );

      if (fileExists) {
        // File exists - read existing content and append
        const existingContent = yield* fs.readFileString(envPath);
        const newContent = existingContent + envOutput;
        yield* fs.writeFileString(envPath, newContent);
        yield* Console.log('✓ Configuration appended to existing .env file');
      } else {
        // File doesn't exist - create new file
        yield* fs.writeFileString(envPath, envOutput.trim());
        yield* Console.log('✓ Created new .env file');
      }

      // Save network info to JSON file in the requested format
      const networkJsonData = {
        [networkName]: {
          chainId: networkId,
          isTestnet: false,
          explorers: [],
          currency: 'ETH',
        },
      };

      // Write new networks.json file (overwrite if exists)
      const networksJsonPath = `${rootDir}/libs/ts/base-utils/src/evm/additional-networks.json`;
      const jsonContent = JSON.stringify(networkJsonData, null, 2);
      yield* fs.writeFileString(networksJsonPath, jsonContent);
      yield* Console.log('✓ Network information saved to networks.json');

      // Print the collected information
      yield* Console.log('\n=== Parsed Data ===');
      yield* Console.log(`Network Name: ${networkName}`);
      yield* Console.log(`Network ID: ${networkId}`);
      yield* Console.log(`Network RPC: ${networkRpc}`);
      yield* Console.log(`Deployer Address: ${deployerAddress}`);
      yield* Console.log(`Deployer Private Key: ${deployerPrivateKey}`);
      yield* Console.log(`Admin Multisig Owner: ${adminMultisigOwner}`);
      yield* Console.log(`Sequencer Address: ${sequencerAddress}`);

      yield* Console.log('\n=== File Updated Successfully ===');
      yield* Console.log('Configuration has been added to .env file');
    }),
);
