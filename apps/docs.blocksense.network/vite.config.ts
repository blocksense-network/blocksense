import { defineConfig } from 'vite';

const extensions = [
  '.web.js',
  '.web.ts',
  '.web.tsx',
  '.js',
  '.jsx',
  '.json',
  '.ts',
  '.tsx',
  '.mjs',
];

export default defineConfig({
  define: {
    DEV: `${process.env.NODE_ENV === 'development' ? true : false}`,
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
  },
  resolve: {
    extensions,
  },
  optimizeDeps: {
    esbuildOptions: {
      resolveExtensions: extensions,
      loader: {
        '.js': 'jsx',
      },
    },
  },
});
