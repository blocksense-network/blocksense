import { pairToString, createPair } from '@blocksense/config-types';
import keccak256 from 'keccak256';
import { fetchAssetsInMarketCapOrder } from '../../data-services/fetchers/aggregators/cmc';
import { stableCoins } from '../data-providers';
import { SimplifiedFeed, SimplifiedFeedWithRank } from '../types';

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

export function removeUnsupportedRateDataFeeds(
  dataFeeds: SimplifiedFeed[],
): SimplifiedFeed[] {
  const unsupported = [
    'exchange rate',
    'exchange-rate',
    'calculated',
    'marketcap',
  ];

  return dataFeeds.filter(
    feed =>
      !unsupported.some(x =>
        feed.additional_feed_info.compatibility_info.chainlink
          .toLowerCase()
          .includes(x),
      ),
  );
}

export function removeNonCryptoDataFeeds(
  dataFeeds: SimplifiedFeed[],
): SimplifiedFeed[] {
  return dataFeeds.filter(
    feed =>
      feed.additional_feed_info.category.toLowerCase() === 'crypto' ||
      feed.additional_feed_info.category.toLowerCase() === '',
  );
}

export async function addMarketCapRank(
  feeds: SimplifiedFeed[],
): Promise<SimplifiedFeedWithRank[]> {
  const cmcMarketCap = await fetchAssetsInMarketCapOrder();

  return feeds.map(feed => {
    const asset = cmcMarketCap.find(
      asset =>
        asset.symbol.toLowerCase() ===
        feed.additional_feed_info.pair.base.toLowerCase(),
    );
    return {
      ...feed,
      rank: asset ? asset.market_cap_rank : Number.MAX_SAFE_INTEGER,
    };
  });
}

// Sort the feeds by rank or description if no rank is available
export function sortFeedsConfig(
  feeds: SimplifiedFeedWithRank[],
): SimplifiedFeedWithRank[] {
  const rankedFeeds = feeds.filter(
    feed => feed.rank !== Number.MAX_SAFE_INTEGER,
  );
  const unrankedFeeds = feeds.filter(
    feed => feed.rank === Number.MAX_SAFE_INTEGER,
  );

  const sortedRankedFeeds = rankedFeeds.sort((a, b) => a.rank - b.rank);

  const sortedUnrankedFeeds = unrankedFeeds.sort((a, b) => {
    const a_ = keccak256(a.description).toString();
    const b_ = keccak256(b.description).toString();
    return a_.localeCompare(b_);
  });

  return [...sortedRankedFeeds, ...sortedUnrankedFeeds];
}
