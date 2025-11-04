import express from 'express';
import client from 'prom-client';

import { getOptionalEnvString } from '@blocksense/base-utils/env';
import type { EthereumAddress } from '@blocksense/base-utils/evm';
import { parseEthereumAddress } from '@blocksense/base-utils/evm';
import { color as c } from '@blocksense/base-utils/tty';

export const startPrometheusServer = (host: string, port: number): void => {
  const app = express();
  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  });
  app.listen(port, host, () => {
    console.log(
      c`{blue Prometheus metrics exposed at http://${host}:${port}/metrics}`,
    );
  });
};

export function filterSmallBalance(balance: string, threshold = 1e-6): number {
  return Number(balance) < threshold ? 0 : Number(balance);
}

export function getDefaultSequencerAddress(
  shouldUseMainnetSequencer: boolean,
): EthereumAddress {
  if (shouldUseMainnetSequencer) {
    return parseEthereumAddress(
      getOptionalEnvString(
        'SEQUENCER_ADDRESS_MAINNET',
        '0x1F412F1dBab58E41d37ba31115c811B0fBD10904',
      ),
    );
  } else {
    return parseEthereumAddress(
      getOptionalEnvString(
        'SEQUENCER_ADDRESS_TESTNET',
        '0xd756119012CcabBC59910dE0ecEbE406B5b952bE',
      ),
    );
  }
}
