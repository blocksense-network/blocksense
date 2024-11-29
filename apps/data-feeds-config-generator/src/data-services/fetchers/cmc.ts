import * as S from '@effect/schema/Schema';

import { getEnvString } from '@blocksense/base-utils/env';
import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';

import { CMCInfo, CMCInfoSchema } from '../types';

export async function getCMCCryptoList(): Promise<readonly CMCInfo[]> {
  const url = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/map';

  const t = S.Struct({
    data: S.Array(CMCInfoSchema),
  });

  const typedData = await fetchAndDecodeJSON(t, url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'X-CMC_PRO_API_KEY': getEnvString('CMC_API_KEY'),
    },
  });

  return typedData.data;
}
