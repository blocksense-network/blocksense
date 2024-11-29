import { assertNotNull } from '@blocksense/base-utils/assert';

import { CMCInfo, decodeCMCInfo } from '../types';

export async function getCMCCryptoList(): Promise<readonly CMCInfo[]> {
  const url = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/map';
  const headers = {
    'X-CMC_PRO_API_KEY': assertNotNull(
      process.env['CMC_API_KEY'],
      'CMC_API_KEY env variable not set',
    ),
    Accept: 'application/json',
  };

  const fullUrl = `${url}`;

  const response = await fetch(fullUrl, { headers });
  if (!response.ok) {
    throw new Error(
      `Failed to fetch CoinMarketCap crypto list;
response:
  status=${response.status};
  text=
${await response.text()}`,
    );
  }
  const typedData = (await response.json()) as { data: unknown[] };

  const supportedCMCCurrencies = decodeCMCInfo(typedData.data);

  return supportedCMCCurrencies;
}
