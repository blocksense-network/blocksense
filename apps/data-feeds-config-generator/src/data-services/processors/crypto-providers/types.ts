import type { AssetInfo } from '../../fetchers/exchanges/exchange-assets';

export type CryptoProviderData = {
  name: string;
  type: 'exchanges' | 'aggregators';
  data: AssetInfo[];
};
