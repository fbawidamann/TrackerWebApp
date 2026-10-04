/**
 * Barcode scanning (docs/adr/0010-nutrition.md). iOS Safari has no native BarcodeDetector, so we use the
 * `barcode-detector` ponyfill (ZXing compiled to WebAssembly). The ~1 MB wasm is served by us (precached by the
 * service worker), never from a CDN. Loaded lazily: only when the scanner opens.
 */
import type { BarcodeDetector as Detector } from "barcode-detector/ponyfill";

let loading: Promise<Detector> | null = null;

export const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"] as const;

export function loadDetector(): Promise<Detector> {
  loading ??= (async () => {
    const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
      import("barcode-detector/ponyfill"),
      import("zxing-wasm/reader/zxing_reader.wasm?url"),
    ]);
    prepareZXingModule({ overrides: { locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? wasmUrl : prefix + path) }, fireImmediately: true });
    return new BarcodeDetector({ formats: [...FORMATS] });
  })();
  loading.catch(() => { loading = null; });
  return loading;
}

/** EAN/UPC check digit (mod 10) — filters misreads before we ask Open Food Facts. */
export function validBarcode(code: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  const digits = code.split("").map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}
