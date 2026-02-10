/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHANGELLY_PROXY_URL: string;
  readonly VITE_BISQ_PROXY_URL: string;
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
