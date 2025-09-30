import { Schema as S } from 'effect';

import type { NewFeedsConfig } from '@blocksense/config-types';
import { cexPriceFeedsArgsSchema, readConfig } from '@blocksense/config-types';

import { getCryptoProvidersData } from '../../data-services/processors/crypto-providers/data-collection';
import {
  getAllProvidersForPair,
  getExchangesPriceDataForPair,
  removePriceOutliers,
} from '../../data-services/processors/crypto-providers/data-transformers';
import { detectPriceOutliers } from '../../data-services/processors/crypto-providers/outliers-detector';
import type { CryptoProviderData } from '../../data-services/processors/crypto-providers/types';

/**
 * Updates the configuration for exchange arguments in the feeds configuration.
 *
 * This function retrieves the current feeds configuration, fetches crypto providers data,
 * normalizes the providers data, and updates the feeds configuration with the appropriate
 * exchange arguments for each feed. It ensures that only feeds with the oracle ID
 * 'cex-price-feeds' and containing 'aggregators' in their arguments are updated.
 *
 */
export async function updateExchangesArgumentConfig(): Promise<NewFeedsConfig> {
  const feedsConfig = await readConfig('feeds_config_v2');

  const providersData = await getCryptoProvidersData();

  let normalizedProvidersData: CryptoProviderData[] = providersData;
  for (const feed of feedsConfig.feeds) {
    const pair = feed.additional_feed_info.pair;
    const initialExchangePrices = getExchangesPriceDataForPair(
      pair,
      providersData,
    );
    const outlierExchanges = detectPriceOutliers(
      initialExchangePrices,
      ({ dataSourceName, price }) =>
        console.log(
          `Detected Outlier : ${dataSourceName} (${price}) ` +
            `for feed ${feed.full_name}`,
        ),
    );

    normalizedProvidersData = removePriceOutliers(
      providersData,
      pair,
      outlierExchanges,
    );
  }

  const updatedFeedConfig = feedsConfig.feeds.map(feed => {
    const providers = getAllProvidersForPair(
      feed.additional_feed_info.pair,
      normalizedProvidersData,
    );

    if (
      feed.oracle_id !== 'cex-price-feeds' ||
      !S.is(cexPriceFeedsArgsSchema)(feed.additional_feed_info.arguments)
    )
      return feed;

    return {
      ...feed,
      additional_feed_info: {
        ...feed.additional_feed_info,
        arguments: {
          kind: 'cex-price-feeds' as const,
          exchanges: providers.exchanges,
          aggregators: feed.additional_feed_info.arguments.aggregators,
        },
      },
    };
  });

  return { feeds: updatedFeedConfig };
}
