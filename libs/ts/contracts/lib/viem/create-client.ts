import { Chain, createPublicClient, http } from 'viem';
import * as viemChains from 'viem/chains';

import { valuesOf } from '@blocksense/base-utils/array-iter';
import {
  NetworkName,
  isNetworkName,
  networkMetadata,
  getOptionalRpcUrl,
} from '@blocksense/base-utils/evm';
import { throwError } from '@blocksense/base-utils/errors';

/**
 * Create a viem public client for either:
 * - A specific RPC endpoint (when a `URL` instance is provided), or
 * - A known network identified by its `NetworkName`.
 *
 * Behavior:
 * 1. If a `URL` is supplied, a client is created directly with that URL (no
 * chain metadata lookup).
 * 2. If a network name is supplied:
 *    - The name is validated (throws on invalid).
 *    - The corresponding viem Chain is resolved via `getViemChain()`.
 *    - The RPC endpoint is selected in this priority order:
 *        a. Value returned by `getOptionalRpcUrl(network)` (e.g. environment
 *        override) if non-empty.
 *        b. The first default RPC URL from the viem chain definition.
 *       Throws if neither is available.
 *
 * Errors:
 * - Throws if the provided string is not a valid NetworkName.
 * - Throws if no RPC URL can be derived for a valid network.
 *
 * @param networkNameOrRpcUrl A NetworkName (e.g. 'mainnet', 'polygon') or a
 * concrete RPC endpoint as a URL object.
 * @returns A configured viem public client bound to the resolved transport (and
 * chain when a network is used).
 * @throws Error when validation fails or an RPC URL cannot be determined.
 */
export function createViemClient(networkNameOrRpcUrl: NetworkName | URL) {
  if (networkNameOrRpcUrl instanceof URL) {
    return createPublicClient({
      transport: http(networkNameOrRpcUrl.toString()),
    });
  }

  if (!isNetworkName(networkNameOrRpcUrl)) {
    throwError(`Invalid network name: '${networkNameOrRpcUrl}'.`);
  }

  const chain = getViemChain(networkNameOrRpcUrl);
  const rpcUrlFromEnv = getOptionalRpcUrl(networkNameOrRpcUrl);
  const rpcUrlFromViem = chain?.rpcUrls.default.http[0];
  const rpcUrl =
    rpcUrlFromEnv !== ''
      ? rpcUrlFromEnv
      : (rpcUrlFromViem ??
        throwError(`No RPC URL found for network: ${networkNameOrRpcUrl}`));

  return createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
}

/**
 * Resolve the viem Chain metadata for a given internal NetworkName.
 *
 * The function:
 * - Reads the chainId from `networkMetadata[network]`.
 * - Scans all exported `viem/chains` definitions to find a matching `id`.
 * - Returns the corresponding Chain object if found.
 *
 * Failure handling:
 * - If no matching chain is found, logs a descriptive error to the console
 *   and returns `undefined` instead of throwing (allowing caller logic to
 *   decide how to proceed).
 *
 * @param network The internal network identifier whose chain metadata should be
 * resolved.
 * @returns The matching viem Chain object, or undefined if not found.
 * @remarks This function performs a linear search over the imported chains
 *          and intentionally does not throw to keep calling code flexible.
 */
export function getViemChain(network: NetworkName): Chain | undefined {
  const id = networkMetadata[network].chainId;
  const chain = valuesOf(viemChains).find(chain => chain.id === id);
  if (!chain) {
    console.error(`Viem chain definition not found for network: ${network}`);
    return undefined;
  }
  return chain;
}
