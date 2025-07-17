import express from 'express';
import chalk from 'chalk';
import client from 'prom-client';

export const startPrometheusServer = (host: string, port: number): void => {
  const app = express();
  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  });
  app.listen(port, host, () => {
    console.log(
      chalk.blue(
        `Prometheus metrics exposed at http://${host}:${port}/metrics`,
      ),
    );
  });
};
