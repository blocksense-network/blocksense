import { Chain } from 'viem';
import * as viemChains from 'viem/chains';
import { Schema as S } from 'effect';

import {
  NetworkName,
  hexDataString,
  networkMetadata,
  valuesOf,
} from '@blocksense/base-utils';

export function getViemChain(network: NetworkName): Chain | undefined {
  const id = networkMetadata[network].chainId;
  const chain = valuesOf(viemChains).find(chain => chain.id === id);
  if (!chain) {
    console.error(`Viem chain definition not found for network: ${network}`);
    return undefined;
  }
  return chain;
}
