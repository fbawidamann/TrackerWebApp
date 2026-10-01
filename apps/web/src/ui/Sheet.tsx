import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/i18n";
import { IconCheck } from "./icons";

let locks = 0;
/** Locks page scrolling while any sheet/overlay is open. */
export function useScrollLock(active = true): void {
  useEffect(() => {
    if (!active) return;
    locks++;
    document.body.classList.add("lock");
    return () => {
      locks--;
      if (!locks) document.body.classList.remove("lock");
    };
  }, [active]);
}

export function useEscape(onEscape: () => void, active = true): void {
  useEffect(() => {
    if (!active) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onEscape(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onEscape, active]);
}

/** Bottom sheet (centered dialog on desktop). */
export function Sheet({ onClose, label, children }: { onClose: () => void; label: string; children: ReactNode }) {
  useScrollLock();
  useEscape(onClose);
  return createPortal(
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label}>
        <div className="grab" />
        {children}
      </div>
    </>,
    document.body,
  );
}

export interface MenuItem {
  label: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  checked?: boolean;
}

export function MenuSheet({ title, items, onClose }: { title: string; items: MenuItem[]; onClose: () => void }) {
  return (
    <Sheet onClose={onClose} label={title}>
      <h3>{title}</h3>
      <div className="menu">
        {items.map((it, i) => (
          <button key={i} type="button" className={"mi" + (it.danger ? " danger" : "")} onClick={() => { onClose(); it.onSelect(); }}>
            <span>{it.label}</span>
            {it.checked && <IconCheck />}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

export function ConfirmSheet(props: {
  title: string; text?: ReactNode; confirm: string; cancel?: string; danger?: boolean;
  onConfirm: () => void; onClose: () => void;
}) {
  const t = useT();
  const { title, text, confirm, cancel = t.common.cancel, danger, onConfirm, onClose } = props;
  return (
    <Sheet onClose={onClose} label={title}>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      <div className="acts">
        <button type="button" className={"btn btn-block " + (danger ? "btn-danger" : "btn-primary")} onClick={() => { onClose(); onConfirm(); }}>{confirm}</button>
        <button type="button" className="btn btn-block" onClick={onClose}>{cancel}</button>
      </div>
    </Sheet>
  );
}

export function RadioSheet<T extends string | number>(props: {
  title: string; sub?: string; value: T; options: Array<[T, string]>; onChange: (v: T) => void; onClose: () => void;
}) {
  const { title, sub, value, options, onChange, onClose } = props;
  return (
    <Sheet onClose={onClose} label={title}>
      <div>
        <h3>{title}</h3>
        {sub && <p>{sub}</p>}
      </div>
      <div role="radiogroup" aria-label={title}>
        {options.map(([v, l]) => (
          <button key={String(v)} type="button" role="radio" className="radio" aria-checked={v === value} onClick={() => { onChange(v); onClose(); }}>
            <span>{l}</span>
            <IconCheck />
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/** Sheet with one text field and Save. */
export function TextSheet(props: {
  title: string; initial: string; maxLength: number; placeholder?: string; onSave: (v: string) => void; onClose: () => void;
}) {
  const { title, initial, maxLength, placeholder, onSave, onClose } = props;
  const t = useT();
  const submit = (form: HTMLFormElement) => {
    const v = (new FormData(form).get("v") as string | null) ?? "";
    onSave(v.trim());
    onClose();
  };
  return (
    <Sheet onClose={onClose} label={title}>
      <h3>{title}</h3>
      <form onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }} className="acts">
        <input className="field" name="v" defaultValue={initial} maxLength={maxLength} placeholder={placeholder} aria-label={title} autoFocus autoComplete="off" />
        <button type="submit" className="btn btn-primary btn-block">{t.common.save}</button>
      </form>
    </Sheet>
  );
}
