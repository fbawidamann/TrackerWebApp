import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useEscape, useScrollLock } from "./Sheet";

/** Full-screen layer (picker, editors) above the app, below sheets. */
export function Overlay({ label, onEscape, className, children }: { label: string; onEscape?: () => void; className?: string; children: ReactNode }) {
  useScrollLock();
  useEscape(onEscape ?? (() => {}), !!onEscape);
  return createPortal(
    <div className={"overlay" + (className ? ` ${className}` : "")} role="dialog" aria-modal="true" aria-label={label}>
      {children}
    </div>,
    document.body,
  );
}
