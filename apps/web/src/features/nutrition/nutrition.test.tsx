import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proteinDays } from "@/lib/nutrition";
import { ProteinRing, ProteinWeek } from "./ProteinRing";
import { ScannerOverlay } from "./ScannerOverlay";
import { validBarcode } from "./scanner";

vi.mock("./scanner", async (orig) => ({ ...(await orig<typeof import("./scanner")>()), loadDetector: async () => ({ detect: async () => [] }) }));

afterEach(cleanup);

describe("ProteinRing", () => {
  it("shows grams, target and the status word; colour class follows the status; VoiceOver label", () => {
    const { container } = render(<ProteinRing protein={98.4} target={145} status="meh" />);
    expect(container.querySelector(".pring")!.classList.contains("ps-meh")).toBe(true);
    expect(screen.getByRole("img", { name: "Protein 98 of 145 grams, so-so" })).toBeTruthy();
    expect(screen.getByText("so-so")).toBeTruthy();
    // ring fill = 98.4 / 145 of the circumference
    const fg = container.querySelector(".pring-fg")!;
    const c = Number(fg.getAttribute("stroke-dasharray"));
    expect(Number(fg.getAttribute("stroke-dashoffset")) / c).toBeCloseTo(1 - 98.4 / 145, 3);
  });
  it("full ring over target, dark green", () => {
    const { container } = render(<ProteinRing protein={200} target={145} status="great" />);
    expect(Number(container.querySelector(".pring-fg")!.getAttribute("stroke-dashoffset"))).toBe(0);
    expect(screen.getByText("very good")).toBeTruthy();
  });
});

describe("ProteinWeek", () => {
  it("7 day buttons, future days disabled, selected day pressed", () => {
    const now = new Date(2026, 9, 4, 12);
    const days = proteinDays([], new Date(2026, 9, 5), 150, now);
    render(<ProteinWeek days={days} selected={new Date(2026, 9, 4)} onSelect={() => {}} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(7);
    expect((buttons[6] as HTMLButtonElement).disabled).toBe(true);
    expect(buttons[5]!.getAttribute("aria-pressed")).toBe("true");
  });
});

describe("barcode check digit", () => {
  it("accepts valid EAN-13/EAN-8/UPC-A, rejects misreads", () => {
    expect(validBarcode("4000417025005")).toBe(true);
    expect(validBarcode("4000417025006")).toBe(false);
    expect(validBarcode("96385074")).toBe(true);
    expect(validBarcode("036000291452")).toBe(true);
    expect(validBarcode("12345")).toBe(false);
  });
});

describe("ScannerOverlay", () => {
  it("shows the camera inline (iOS: playsinline + muted as attributes), stops it on close", async () => {
    const stopTrack = vi.fn();
    const stream = { getTracks: () => [{ stop: stopTrack }], getVideoTracks: () => [{ stop: stopTrack, getCapabilities: () => ({}) }] };
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn(async () => stream) } });
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const { container, unmount } = render(<ScannerOverlay onCode={() => {}} onClose={() => {}} />);
    await waitFor(() => expect(play).toHaveBeenCalled());
    const v = document.querySelector("video.scan-video") as HTMLVideoElement;
    expect(v.hasAttribute("playsinline")).toBe(true);
    expect(v.hasAttribute("webkit-playsinline")).toBe(true);
    expect(v.muted).toBe(true);
    expect(container).toBeTruthy();
    unmount();
    expect(stopTrack).toHaveBeenCalled();
    play.mockRestore();
  });

  it("offers a start button when autoplay is refused", async () => {
    const stream = { getTracks: () => [], getVideoTracks: () => [] };
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn(async () => stream) } });
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValue(new Error("NotAllowedError"));
    render(<ScannerOverlay onCode={() => {}} onClose={() => {}} />);
    expect(await screen.findByRole("button", { name: "Start camera" })).toBeTruthy();
    play.mockRestore();
  });
});

describe("scanner layering", () => {
  it("Scan button: the camera layer sits above Add food even though its portal comes first in the DOM", async () => {
    const stream = { getTracks: () => [], getVideoTracks: () => [] };
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn(async () => stream) } });
    const { AddFood } = await import("./AddFood");
    const { ToastProvider } = await import("@/ui/Toast");
    render(<ToastProvider><AddFood day={new Date()} startWithScan onClose={() => {}} /></ToastProvider>);
    const scanner = document.querySelector(".scan")!.closest(".overlay")!;
    expect(scanner.classList.contains("scan-layer")).toBe(true);
  });
});
