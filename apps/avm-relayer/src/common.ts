import { AccountWallet, AztecAddress, createPXEClient, waitForPXE } from "@aztec/aztec.js";
import { Effect } from "effect";
import { AggregatedDataFeedStoreContract } from "./AggregatedDataFeedStore";
import { Feed, KafkaMessage, TransformedBatch } from "./interfaces";


export const setupSandbox = Effect.gen(function* (_) {
    const { PXE_URL = 'http://localhost:8080' } = process.env;
    const pxe = createPXEClient(PXE_URL);

    yield* _(
        Effect.tryPromise({
            try: () => waitForPXE(pxe),
            catch: (err) => new Error("Failed to connect with PXE: " + String(err))
        })
    );

    return pxe;
});


/**
 * Updates the AggregatedDataFeedStore (ADFS) smart contract with a new batch of feed data.
 * 
 * This function connects to the contract at the given address using the provided sequencer wallet,
 * and invokes the `update_feeds` method with the serialized feed data and metadata.
 * 
 * @param contractAddress - The on-chain Aztec address of the deployed ADFS contract.
 * @param sequencerWallet - The wallet (typically a sequencer) authorized to perform updates.
 * @param feedInputData - An array of bigints representing the serialized feed data.
 * @param feedsLen - The number of feeds in the current batch.
 * @param indicesLen - Length of the keys in the ring buffer.
 * @param blockNumber - The block number corresponding to the update.
 */
export const updateFeedsInADFSContract = (
    contractAddress: AztecAddress,
    sequencerWallet: AccountWallet,
    feedInputData: bigint[],
    feedsLen: bigint,
    indicesLen: bigint,
    blockNumber: bigint
) =>
    Effect.gen(function* (_) {
        yield* _(Effect.log("Updating feeds in ADFS contract..."));

        const contract = yield* _(
            Effect.tryPromise({
                try: () =>
                    AggregatedDataFeedStoreContract.at(contractAddress, sequencerWallet),
                catch: (err) =>
                    new Error("Failed to get contract instance: " + String(err)),
            })
        );

        const tx = yield* _(
            Effect.tryPromise({
                try: () =>
                    contract
                        .withWallet(sequencerWallet)
                        .methods.update_feeds(feedInputData, feedsLen, indicesLen, blockNumber)
                        .send(),
                catch: (err) =>
                    new Error("Contract method call failed: " + String(err)),
            })
        );

        yield* _(
            Effect.tryPromise({
                try: () => tx.wait(),
                catch: (err) =>
                    new Error("Transaction failed: " + String(err)),
            })
        );

        yield* _(Effect.log("Successfully updated feeds in ADFS contract!"));
    });


export const getADFSContract = (
    contractAddress: AztecAddress,
    wallet: AccountWallet
) =>
    Effect.tryPromise({
        try: () => AggregatedDataFeedStoreContract.at(contractAddress, wallet),
        catch: (err) =>
            new Error("Failed to get ADFS contract: " + String(err)),
    });


/**
 * Batches an array of feeds into groups such that the total computed size of each batch
 * does not exceed a maximum batch size.
 * 
 * The size of each feed is calculated as: `stride + current feed counter`,
 * and batches are formed greedily while respecting the maximum allowed batch size.
 * 
 * @param feeds - An array of Feed objects to be batched.
 * @param feedCounters - A mapping of feed IDs to the number of times it has been updated.
 *                       This is used to compute the contribution size of each feed.
 * @returns An array of feed batches, where each batch is an array of Feed objects.
 */
export function batchFeeds(feeds: Feed[], feedCounters: Map<bigint, bigint>): Feed[][] {
    const MAX_BATCH_SIZE = 62n;
    const batches: Feed[][] = [];
    let currentBatch: Feed[] = [];
    let currentBatchSize = 0n;

    for (const feed of feeds) {
        // Get current counter for this feed ID from feedCounters
        const currentCounter = feedCounters.get(feed.id) ?? 0n;
        console.log('currentCounter: ', currentCounter);
        // Calculate size this feed would add to the batch
        // Size is stride + current counter from feedCounters
        const feedSize = feed.stride + 1n; // TODO: Explain why it's hardcoded to one right now

        // If adding this feed would exceed MAX_BATCH_SIZE, start a new batch
        if (currentBatchSize + feedSize > MAX_BATCH_SIZE) {
            if (currentBatch.length > 0n) {
                batches.push([...currentBatch]);
            }
            currentBatch = [feed];
            // Reset batch size to this feed's size
            currentBatchSize = feedSize;
        } else {
            currentBatch.push(feed);
            currentBatchSize += feedSize;
        }
        break;
    }

    // Add the last batch if it's not empty
    if (currentBatch.length > 0n) {
        batches.push([...currentBatch]);
    }

    return batches;
}

export const transformKafkaMessageToContractFormat = (
    message: KafkaMessage,
    feedCounters: Map<bigint, bigint>
): Effect<never, never, TransformedBatch[]> =>
    Effect.sync(() => {
        const feeds: Feed[] = message.updates.map(update => {
            const id = BigInt(update.feedId);
            const currentCounter = feedCounters.get(id) ?? 0n;

            // ⚠️ Mutates shared state — make this clear
            feedCounters.set(id, currentCounter);

            const data = '0x' + Buffer.from(update.value).toString('hex');

            return {
                id,
                index: currentCounter,
                stride: 0n, // TODO: Replace with update.stride once synced with sequencer
                data,
                readParticularFieldSlotOfData: 0,
            };
        });

        const batchedFeeds = batchFeeds(feeds, feedCounters);

        return batchedFeeds.map(batch => {
            const [feedInputData, indexRowsLen] = serializeFeedsAndCountersToArray(batch, feedCounters);
            return {
                feedInputData,
                randomNumberOfFeeds: BigInt(batch.length),
                indexRowsLen,
                blockNumber: message.blockHeight,
            };
        });
    });

/**
 * Generates a random bigint with up to the specified number of bits.
 * 
 * This function creates a random sequence of bytes, converts them to a hex string,
 * and parses the result into a bigint. The resulting value is uniformly distributed
 * in the range [0, 2^bits).
 * 
 * @param bits - The maximum number of bits for the generated bigint.
 * @returns A random bigint value with up to `bits` bits of entropy.
 */
export function generateRandomBigInt(bits: number): bigint {
    const bytes = Math.ceil(bits / 8);
    const hex = Array.from({ length: bytes }, () =>
        Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
    ).join('');
    return BigInt('0x' + hex);
}

/**
 * Reconstructs a single bigint value from an array of limbs using the specified base.
 * 
 * It's used to combine smaller chunks of a large number (limbs)
 * back into the original bigint, using a base (e.g. BN254_PRIME).
 * 
 * @param limbs - An array of bigint limbs, ordered from least to most significant.
 * @param base - The base used for reconstructing the number (in our case bn254's field prime).
 * @returns The reconstructed bigint value.
 */
export function limbsToBigInt(limbs: bigint[], base: bigint): bigint {
    return limbs.reduceRight((acc, limb) => acc * base + limb, 0n);
}
