import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        nodePolyfills({
          include: ['buffer', 'stream', 'util', 'crypto'],
          globals: {
            Buffer: true,
            global: true,
            process: true,
          },
        }),
      ],
      test: {
        globals: true,
        environment: 'node', // Changed from jsdom to node for crypto/buffer support
        setupFiles: './tests/setup.ts',
        server: {
          deps: {
            inline: ["generator-function", "is-generator-function", "bip32", "ecpair", "tiny-secp256k1"]
          }
        },
        pool: 'forks', // More stable for native modules
      },
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
