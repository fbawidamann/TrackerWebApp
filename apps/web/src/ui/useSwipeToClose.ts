import { useEffect, useRef, type RefObject } from "react";

/** Distance (px) or flick speed (px/ms) that closes the sheet when the finger is lifted. */
export const CLOSE_DISTANCE = 90;
export const CLOSE_VELOCITY = 0.5;
const CLOSE_MS = 200;

/**
 * Swipe-down-to-close for bottom sheets (phone only, docs/design/ui-guidelines.md "Sheets").
 * The drag only starts when the sheet content is scrolled to the very top and the finger moves down,
 * so normal scrolling inside a long sheet (e.g. routine preview) keeps working. Below the threshold
 * the sheet springs back. Touch only: on desktop the sheet is a centred dialog without a grab handle.
 */
export function useSwipeToClose(
  sheetRef: RefObject<HTMLElement | null>,
  scrimRef: RefObject<HTMLElement | null>,
  onClose: () => void,
): void {
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const scrim = scrimRef.current;
    const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    let startY = 0, startX = 0, lastY = 0, lastT = 0, velocity = 0;
    let tracking = false, dragging = false, closing = false;

    const place = (dy: number, animate: boolean) => {
      sheet.style.transition = animate && !reduced() ? `transform ${CLOSE_MS}ms ease` : "none";
      sheet.style.transform = dy ? `translate(-50%, ${dy}px)` : "";
      if (scrim) {
        scrim.style.transition = sheet.style.transition.replace("transform", "opacity");
        scrim.style.opacity = dy ? String(Math.max(0, 1 - dy / Math.max(sheet.offsetHeight, 1))) : "";
      }
    };

    const onStart = (e: TouchEvent) => {
      // Desktop/tablet layout (>= 1024 px) shows a centred dialog without grab handle: no swipe there.
      if (closing || e.touches.length !== 1 || window.matchMedia?.("(min-width: 1024px)").matches) { tracking = false; return; }
      const t = e.touches[0]!;
      startY = lastY = t.clientY;
      startX = t.clientX;
      lastT = e.timeStamp;
      velocity = 0;
      tracking = true;
      dragging = false;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking || closing) return;
      const t = e.touches[0]!;
      const dy = t.clientY - startY;
      if (!dragging) {
        // Decide once per gesture: only a downward, mostly vertical move at scrollTop 0 becomes a drag.
        if (Math.abs(dy) < 6 && Math.abs(t.clientX - startX) < 6) return;
        if (dy <= 0 || sheet.scrollTop > 0 || Math.abs(t.clientX - startX) > Math.abs(dy)) { tracking = false; return; }
        dragging = true;
      }
      e.preventDefault(); // stop iOS rubber-banding / page scroll while dragging the sheet
      const dt = e.timeStamp - lastT;
      if (dt > 0) velocity = (t.clientY - lastY) / dt;
      lastY = t.clientY;
      lastT = e.timeStamp;
      place(Math.max(0, dy), false);
    };

    const onEnd = () => {
      if (!dragging) { tracking = false; return; }
      tracking = dragging = false;
      const dy = Math.max(0, lastY - startY);
      if (dy > CLOSE_DISTANCE || velocity > CLOSE_VELOCITY) {
        closing = true;
        if (reduced()) { close.current(); return; }
        place(sheet.offsetHeight + 40, true);
        window.setTimeout(() => close.current(), CLOSE_MS);
      } else {
        place(0, true);
      }
    };

    sheet.addEventListener("touchstart", onStart, { passive: true });
    sheet.addEventListener("touchmove", onMove, { passive: false });
    sheet.addEventListener("touchend", onEnd);
    sheet.addEventListener("touchcancel", onEnd);
    return () => {
      sheet.removeEventListener("touchstart", onStart);
      sheet.removeEventListener("touchmove", onMove);
      sheet.removeEventListener("touchend", onEnd);
      sheet.removeEventListener("touchcancel", onEnd);
    };
  }, [sheetRef, scrimRef]);
}
