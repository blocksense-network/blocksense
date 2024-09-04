import { assertNotNull } from '@blocksense/base-utils/assert';
import { selectDirectory } from '@blocksense/base-utils/fs';

import { CMCInfo, decodeCMCInfo } from './types';
import { artifactsDir } from '../paths';

export async function getCMCCryptoList(): Promise<readonly CMCInfo[]> {
  const url = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/map';
  const headers = {
    'X-CMC_PRO_API_KEY': assertNotNull(process.env['CMC_API_KEY']),
    Accept: 'application/json',
  };

  const fullUrl = `${url}`;

  const response = await fetch(fullUrl, { headers });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const typedData = (await response.json()) as { data: unknown[] };

  const supportedCMCCurrencies = decodeCMCInfo(typedData.data);

  {
    const { writeJSON } = selectDirectory(artifactsDir);
    await writeJSON({
      content: { supportedCMCCurrencies },
      name: 'cmc_currencies',
    });
  }

  return supportedCMCCurrencies;
}
