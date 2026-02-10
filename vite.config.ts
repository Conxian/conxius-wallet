import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isVitest = process.env.VITEST === 'true';
    return {
      server: {
        port: 3000,
        host: "127.0.0.1",
        headers: {
          'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://*.mempool.space https://*.hiro.so https://blockstream.info https://*.rsk.co; font-src 'self';",
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'X-XSS-Protection': '1; mode=block',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
        },
      },
      plugins: [
        wasm(),
        topLevelAwait(),
        react(),
        ...(!isVitest
          ? [
              nodePolyfills({
                include: ["buffer", "stream", "util", "crypto", "string_decoder"],
                globals: {
                  Buffer: true,
                  global: true,
                  process: true,
                },
              }),
            ]
          : []),
      ],
      optimizeDeps: {
        include: ['@google/genai']
      },
      test: {
        globals: true,
        environment: "node",
        setupFiles: "./tests/setup.ts",
        exclude: ["e2e/**", "node_modules/**"],
        server: {
          deps: {
            inline: [
              "generator-function",
              "is-generator-function",
              "bip32",
              "ecpair",
              "tiny-secp256k1",
            ],
          },
        },
        pool: "forks",
      },
      define: {
        "process.env": {}, "process.version": JSON.stringify("v18.0.0"),
      },
      resolve: {
        alias: {
          "@": path.resolve(__dirname, "."),
        },
      },
    };
});
