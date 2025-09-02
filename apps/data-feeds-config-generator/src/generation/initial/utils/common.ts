import { keccak256 } from 'viem';

import { createPair, pairToString } from '@blocksense/config-types';

import { SimplifiedFeed, SimplifiedFeedWithRank } from '../types';
import { CMCMarketCapDataRes } from '../../../data-services/fetchers/aggregators/cmc';
import { stableCoins } from '../../../data-services/processors/crypto-providers/constants';

export function getUniqueDataFeeds(
  dataFeeds: SimplifiedFeed[],
): SimplifiedFeed[] {
  const seenPairs = new Set<string>();

  return dataFeeds.filter(feed => {
    const pairKey = pairToString(feed.additional_feed_info.pair);

    if (seenPairs.has(pairKey)) {
      return false;
    }

    seenPairs.add(pairKey);
    return true;
  });
}

export function addStableCoinVariants(
  feeds: SimplifiedFeed[],
): SimplifiedFeed[] {
  const stableCoinVariants = feeds.flatMap(feed => {
    const { base, quote } = feed.additional_feed_info.pair;
    if (quote in stableCoins) {
      return stableCoins[quote as keyof typeof stableCoins]
        .map(altStableCoin => createPair(base, altStableCoin))
        .map(pair => {
          const full_name = pairToString(pair);
          return {
            ...feed,
            full_name,
            additional_feed_info: {
              ...structuredClone(feed.additional_feed_info),
              pair,
            },
          };
        });
    }
    return [];
  });

  return [...feeds, ...stableCoinVariants];
}

export function removeNonCryptoDataFeeds(
  dataFeeds: SimplifiedFeed[],
): SimplifiedFeed[] {
  return dataFeeds.filter(feed =>
    ['', 'Crypto'].some(x => x == feed.additional_feed_info.category),
  );
}

export async function addMarketCapRank(
  feeds: SimplifiedFeed[],
  cmcMarketCap: CMCMarketCapDataRes,
): Promise<SimplifiedFeedWithRank[]> {
  return feeds.map(feed => {
    const asset = cmcMarketCap.find(
      asset =>
        asset.symbol.toLowerCase() ===
        feed.additional_feed_info.pair.base.toLowerCase(),
    );
    return {
      ...feed,
      rank: asset ? asset.market_cap_rank : null,
    };
  });
}

// Sort the feeds by rank or description if no rank is available
export function sortFeedsConfig(
  feeds: SimplifiedFeedWithRank[],
): SimplifiedFeedWithRank[] {
  const rankedFeeds = feeds.filter(feed => feed.rank);
  const unrankedFeeds = feeds.filter(feed => feed.rank === null);

  const sortedRankedFeeds = rankedFeeds.sort((a, b) => a.rank! - b.rank!);

  const sortedUnrankedFeeds = unrankedFeeds.sort((a, b) => {
    const a_ = keccak256(Buffer.from(a.description));
    const b_ = keccak256(Buffer.from(b.description));
    return a_.localeCompare(b_);
  });

  return [...sortedRankedFeeds, ...sortedUnrankedFeeds];
}
