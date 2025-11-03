import express from 'express';
import client from 'prom-client';

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
