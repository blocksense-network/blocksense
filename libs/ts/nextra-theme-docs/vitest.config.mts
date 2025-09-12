import { defineConfig, Plugin } from 'vitest/config';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

let plugins: Plugin[] = [];

try {
  const react = require('@vitejs/plugin-react');
  if (react) plugins.push(react());
} catch (e) {
  // no react plugin
}

export default defineConfig({
  plugins,
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
