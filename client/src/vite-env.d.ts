/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public Socket.IO / API origin, e.g. https://api.example.com (omit for local Vite proxy). */
  readonly VITE_SERVER_URL?: string;
  readonly VITE_ICE_SERVERS_JSON?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
