import { selectDirectory } from '@blocksense/base-utils/fs';
import { artifactsDir } from '../src/paths';
import { getCryptoProvidersData } from '../src/data-services/processors/crypto-providers/data-collection';

async function main() {
  const cryptoProvidersData = await getCryptoProvidersData();

  const { writeJSON } = selectDirectory(artifactsDir);
  await writeJSON({
    name: 'providers_data',
    content: cryptoProvidersData,
  });
}

await main();
