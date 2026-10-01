/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __APP_VERSION__: string;

declare module "@fitness/shared/catalog-version" {
  const value: { catalogVersion: string; translations?: Record<string, string> };
  export default value;
}

/** German names and instructions of the built-in exercises, keyed by slug (docs/adr/0007-german-language.md). */
declare module "@fitness/shared/catalog-de" {
  const value: { exercises: Record<string, { name: string; instructions: string[] }> };
  export default value;
}
