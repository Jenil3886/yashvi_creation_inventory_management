/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const process: {
  env: {
    VITE_API_URL?: string;
    NODE_ENV?: string;
    [key: string]: string | undefined;
  };
};
