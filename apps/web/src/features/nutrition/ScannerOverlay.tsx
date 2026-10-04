import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n";
import { IconClose } from "@/ui/icons";
import { Overlay } from "@/ui/Overlay";
import { loadDetector, validBarcode } from "./scanner";

/**
 * Full-screen camera scanner. Back camera via getUserMedia; frames are decoded ~6×/s (enough, and battery-friendly).
 * A code counts after two identical reads in a row (no misreads). Typing the number is always possible.
 * The camera stops as soon as the overlay closes or the app goes to the background.
 */
export function ScannerOverlay({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const t = useT();
  const n = t.nutrition;
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [typed, setTyped] = useState("");
  const [torch, setTorch] = useState<null | boolean>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const done = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;
    let last = "";
    const stop = () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((tr) => tr.stop());
      stream = null;
    };
    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setError(n.cameraMissing); setManual(true); return; }
      try {
        const [detector, s] = await Promise.all([
          loadDetector(),
          navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }),
        ]);
        if (stopped) { s.getTracks().forEach((tr) => tr.stop()); return; }
        stream = s;
        const track = s.getVideoTracks()[0] ?? null;
        trackRef.current = track;
        const caps = (track?.getCapabilities?.() ?? {}) as { torch?: boolean };
        if (caps.torch) setTorch(false);
        const v = video.current!;
        v.srcObject = s;
        await v.play().catch(() => {});
        const tick = async () => {
          if (stopped || done.current) return;
          if (v.readyState >= 2) {
            try {
              const codes = await detector.detect(v);
              const code = codes.map((c) => c.rawValue).find(validBarcode);
              if (code && code === last) {
                done.current = true;
                navigator.vibrate?.(30);
                stop();
                onCode(code);
                return;
              }
              last = code ?? "";
            } catch { /* frame not ready */ }
          }
          timer = window.setTimeout(() => void tick(), 160);
        };
        void tick();
      } catch (e) {
        const name = (e as { name?: string }).name;
        setError(name === "NotAllowedError" || name === "SecurityError" ? n.cameraDenied : name === "NotFoundError" ? n.cameraMissing : n.cameraDenied);
        setManual(true);
      }
    };
    void start();
    const onVis = () => { if (document.visibilityState === "hidden") { stop(); onClose(); } };
    document.addEventListener("visibilitychange", onVis);
    return () => { stop(); document.removeEventListener("visibilitychange", onVis); };
    // Start once per open; onCode/onClose are stable enough for this lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleTorch = async () => {
    const next = !torch;
    try {
      await trackRef.current?.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorch(next);
    } catch { setTorch(null); }
  };
  const submitTyped = () => {
    const code = typed.replace(/\D/g, "");
    if (/^\d{6,14}$/.test(code)) { done.current = true; onCode(code); }
  };

  return (
    <Overlay label={n.scanTitle} onEscape={onClose}>
      <div className="scan">
        <video ref={video} className="scan-video" playsInline muted autoPlay aria-hidden="true" />
        <div className="scan-frame" aria-hidden="true"><i /></div>
        <div className="scan-top">
          <button type="button" className="ib scan-ib" onClick={onClose} aria-label={t.common.close}><IconClose /></button>
          <span className="scan-title">{n.scanTitle}</span>
          {torch !== null ? (
            <button type="button" className="chip scan-chip" aria-pressed={torch} onClick={() => void toggleTorch()}>{n.scanTorch}</button>
          ) : <span style={{ width: 40 }} />}
        </div>
        <div className="scan-bottom">
          {error ? <p className="scan-msg" role="alert">{error}</p> : <p className="scan-msg">{n.scanHint}</p>}
          {manual ? (
            <form className="scan-manual" onSubmit={(e) => { e.preventDefault(); submitTyped(); }}>
              <input className="field" inputMode="numeric" autoComplete="off" placeholder="4000417025005" aria-label={n.barcode}
                value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
              <button type="submit" className="btn btn-primary" disabled={!/^\d{6,14}$/.test(typed.replace(/\D/g, ""))}>OK</button>
            </form>
          ) : (
            <button type="button" className="chip scan-chip" onClick={() => setManual(true)}>{n.scanManual}</button>
          )}
        </div>
      </div>
    </Overlay>
  );
}
