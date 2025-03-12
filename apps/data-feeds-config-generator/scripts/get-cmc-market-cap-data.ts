import { selectDirectory } from '@blocksense/base-utils/fs';
import { fetchAssetsInMarketCapOrder } from '../src/data-services/fetchers/aggregators/cmc';
import { artifactsDir } from '../src/paths';

async function main() {
  const cmcData = await fetchAssetsInMarketCapOrder();
  const { writeJSON } = selectDirectory(artifactsDir);

  await writeJSON({ name: 'cmc_market_cap_data', content: cmcData });
}

await main();
