import { configDir } from '@blocksense/base-utils/env';
import { selectDirectory } from '@blocksense/base-utils/fs';

import { updateExchangesArgumentConfig } from '../src/generation/update/crypto-providers';

async function main() {
  const updatedFeedConfig = await updateExchangesArgumentConfig();

  const { writeJSON } = selectDirectory(configDir);
  await writeJSON({
    name: 'feeds_config_v2',
    content: updatedFeedConfig,
  });
}

await main();
