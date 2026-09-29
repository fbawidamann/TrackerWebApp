/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __APP_VERSION__: string;

declare module "@fitness/shared/catalog-version" {
  const value: { catalogVersion: string };
  export default value;
}
