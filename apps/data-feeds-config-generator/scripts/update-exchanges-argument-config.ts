import { writeConfig } from '@blocksense/config-types';

import { updateExchangesArgumentConfig } from '../src/generation/update/crypto-providers';

const updatedFeedConfig = await updateExchangesArgumentConfig();
await writeConfig('feeds_config_v2', updatedFeedConfig);
