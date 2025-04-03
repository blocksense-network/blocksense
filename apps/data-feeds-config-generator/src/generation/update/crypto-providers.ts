import { configDir } from '@blocksense/base-utils/env';
import { selectDirectory } from '@blocksense/base-utils/fs';
import { NewFeedsConfig, NewFeedsConfigSchema } from '@blocksense/config-types';

import {
  getAllProvidersForPair,
  getExchangesPriceDataForPair,
  removePriceOutliers,
} from '../../data-services/processors/crypto-providers/data-transformers';
import { detectPriceOutliers } from '../../data-services/processors/crypto-providers/outliers-detector';
import { CryptoProviderData } from '../../data-services/processors/crypto-providers/types';
import { SimplifiedFeed } from '../initial/types';
import { getCryptoProvidersData } from '../../data-services/processors/crypto-providers/data-collection';

/**
 * Updates the configuration for exchange arguments in the feeds configuration.
 *
 * This function retrieves the current feeds configuration, fetches crypto providers data,
 * normalizes the providers data, and updates the feeds configuration with the appropriate
 * exchange arguments for each feed. It ensures that only feeds with the oracle ID
 * 'crypto-price-feeds' and containing 'aggregators' in their arguments are updated.
 *
 */
export async function updateExchangesArgumentConfig(): Promise<NewFeedsConfig> {
  const { decodeJSON } = selectDirectory(configDir);
  const configFileName = 'feeds_config_v2';

  const feedsConfig = await decodeJSON(
    { name: configFileName },
    NewFeedsConfigSchema,
  );

  const providersData = await getCryptoProvidersData();

  const normalizedProvidersData = normalizeAllPriceFeedsProviders(
    feedsConfig.feeds,
    providersData,
  );

  const updatedFeedConfig = feedsConfig.feeds.map(feed => {
    const providers = getAllProvidersForPair(
      feed.additional_feed_info.pair,
      normalizedProvidersData,
    );
    if (
      feed.oracle_id !== 'crypto-price-feeds' ||
      !('aggregators' in feed.additional_feed_info.arguments)
    )
      return feed;
    return {
      ...feed,
      additional_feed_info: {
        ...feed.additional_feed_info,
        arguments: {
          exchanges: providers.exchanges,
          aggregators: feed.additional_feed_info.arguments.aggregators,
        },
      },
    };
  });

  return { feeds: updatedFeedConfig };
}

function normalizeAllPriceFeedsProviders(
  feeds: SimplifiedFeed[],
  providersData: CryptoProviderData[],
) {
  let normalizedProvidersData: CryptoProviderData[] = providersData;
  feeds.forEach(feed => {
    normalizedProvidersData = filterOutlierProvidersForFeed(
      feed,
      normalizedProvidersData,
    );
  });

  return normalizedProvidersData;
}

function filterOutlierProvidersForFeed(
  feed: SimplifiedFeed,
  providersData: CryptoProviderData[],
) {
  const pair = feed.additional_feed_info.pair;
  const initialExchangePrices = getExchangesPriceDataForPair(
    pair,
    providersData,
  );
  const outlierExchanges = detectPriceOutliers({
    [feed.full_name]: initialExchangePrices,
  });

  const normalizedProvidersData = removePriceOutliers(
    providersData,
    pair,
    outlierExchanges,
  );

  return normalizedProvidersData;
}
