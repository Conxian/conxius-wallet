import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig(({ mode }) => {
    const isVitest = process.env.VITEST === 'true';
    return {
      worker: { format: 'es', plugins: () => [wasm(), topLevelAwait()] },
      plugins: [
        wasm(), topLevelAwait(), react(),
        ...(!isVitest ? [nodePolyfills({ include: ["buffer", "stream", "util", "crypto", "string_decoder"], globals: { Buffer: true, global: true, process: true } })] : []),
      ],
      test: { globals: true, environment: "node", setupFiles: "./tests/setup.ts", exclude: ["e2e/**", "node_modules/**"], server: { deps: { inline: ["generator-function", "is-generator-function", "bip32", "ecpair", "tiny-secp256k1"] } }, pool: "forks" },
      define: { "process.env": {}, "process.version": JSON.stringify("v18.0.0") },
      resolve: { alias: { "@": path.resolve(__dirname, ".") } },
    };
});
