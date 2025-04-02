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

export function detectOutliers(
  feedPriceData: Record<string, Record<string, number>[]>,
): string[] {
  const outlinerts: string[] = [];
  const [asset, pricesArray] = Object.entries(feedPriceData)[0];

  const zeroPricesFiltered = pricesArray.filter(priceData => {
    const [exchangeName, price] = Object.entries(priceData)[0];
    if (price === 0 || price < 0 || price === null) {
      console.log(
        `Detected Outlier : ${exchangeName} (${price}) for feed ${asset}`,
      );
      outlinerts.push(exchangeName);
      return false;
    }
    return true;
  });

  // Convert array of { Exchange: Price } into a single object { Exchange: Price }
  const prices: Record<string, number> = Object.assign(
    {},
    ...zeroPricesFiltered,
  );
  const exchanges = Object.keys(prices);
  const priceValues = Object.values(prices);

  const sortedPrices = [...priceValues].sort((a, b) => a - b);
  const middle = Math.floor(sortedPrices.length / 2);
  const medianPrice =
    sortedPrices.length % 2 === 0
      ? (sortedPrices[middle - 1] + sortedPrices[middle]) / 2
      : sortedPrices[middle];

  exchanges.forEach(exchange => {
    const price = prices[exchange];
    if (Math.abs(price - medianPrice) / medianPrice > 0.1) {
      console.log(
        `Detected Outlier : ${exchange} (${price}) for feed ${asset}`,
      );
      outlinerts.push(exchange);
    }
  });
  return outlinerts;
}
