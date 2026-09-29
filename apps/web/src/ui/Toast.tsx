import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

interface ToastState { text: string; undo?: () => void | Promise<void> }
type Show = (text: string, undo?: () => void | Promise<void>) => void;

const ToastCtx = createContext<Show>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback<Show>((text, undo) => {
    window.clearTimeout(timer.current);
    setToast({ text, undo });
    timer.current = window.setTimeout(() => setToast(null), undo ? 5000 : 3200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast && (
        <div className="toast-wrap">
          <div className="toast" role="status">
            <span>{toast.text}</span>
            {toast.undo && (
              <button type="button" onClick={() => { const u = toast.undo; setToast(null); void u?.(); }}>Undo</button>
            )}
          </div>
        </div>
      )}
    </ToastCtx.Provider>
  );
}

export const useToast = (): Show => useContext(ToastCtx);
