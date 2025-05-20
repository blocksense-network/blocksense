import express from 'express';
import client from 'prom-client';

/**
 * Starts a Prometheus metrics server.
 * @param host Hostname to bind the server (e.g., '0.0.0.0')
 * @param port Port number to expose the /metrics endpoint (e.g., 9100)
 */
export const startPrometheusServer = (host: string, port: number): void => {
  const app = express();

  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  });

  app.listen(port, host, () => {
    console.log(`Prometheus metrics exposed at http://${host}:${port}/metrics`);
  });
};
