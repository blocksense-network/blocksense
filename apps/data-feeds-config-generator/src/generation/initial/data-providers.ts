import { SimplifiedFeed } from './types';
import { getAllProvidersForPair } from '../../data-services/processors/crypto-providers/data-transformers';
import { CryptoProviderData } from '../../data-services/processors/crypto-providers/types';

export async function addDataProviders(
  dataFeeds: SimplifiedFeed[],
  providersData: CryptoProviderData[],
) {
  // Filter out feeds without a quote pair
  const filteredFeeds = filterFeedsWithQuotes(dataFeeds);

  // Map feeds with providers
  const dataFeedsWithCryptoResources = await Promise.all(
    filteredFeeds.map(async feed => {
      const providers = getAllProvidersForPair(
        feed.additional_feed_info.pair,
        providersData,
      );
      return {
        ...feed,
        additional_feed_info: {
          ...feed.additional_feed_info,
          arguments: providers,
        },
      };
    }),
  );

  // Filter out feeds without exchange providers
  const feedsWithExchangeProviders = dataFeedsWithCryptoResources.filter(
    feed => 'exchanges' in feed.additional_feed_info.arguments,
  );

  return feedsWithExchangeProviders;
}

// Filter feeds that have a quote
function filterFeedsWithQuotes(feeds: SimplifiedFeed[]): SimplifiedFeed[] {
  return feeds.filter(feed => feed.additional_feed_info.pair.quote);
}
