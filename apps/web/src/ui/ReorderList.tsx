import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { IconGrip } from "./icons";

export interface ReorderItem { id: string; label: ReactNode }

/** Collapsed rows with drag handles (pointer events: mouse and touch). Calls onChange with the new order on drop. */
export function ReorderList({ items, onChange }: { items: ReorderItem[]; onChange: (ids: string[]) => void }) {
  const [order, setOrder] = useState(() => items.map((i) => i.id));
  const [dragging, setDragging] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const byId = new Map(items.map((i) => [i.id, i]));

  const onDown = (e: PointerEvent<HTMLSpanElement>, id: string) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(id);
  };
  const onMove = (e: PointerEvent<HTMLSpanElement>) => {
    if (!dragging || !listRef.current) return;
    // Rows are rendered in `order`; find the insert position among the other rows.
    const rows = [...listRef.current.children] as HTMLElement[];
    const others = order.filter((x) => x !== dragging);
    let insertAt = others.length;
    let k = 0;
    for (let i = 0; i < rows.length; i++) {
      if (order[i] === dragging) continue;
      const r = rows[i]!.getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) { insertAt = k; break; }
      k++;
    }
    const next = [...others];
    next.splice(insertAt, 0, dragging);
    if (next.join() !== order.join()) setOrder(next);
  };
  const onUp = () => {
    if (dragging) onChange(order);
    setDragging(null);
  };

  return (
    <div className="ro-list" ref={listRef}>
      {order.map((id) => (
        <div key={id} className={"card ro-item" + (dragging === id ? " dragging" : "")}>
          <span className="grow">{byId.get(id)?.label}</span>
          <span className="handle" role="button" aria-label="Drag to reorder" tabIndex={-1}
            onPointerDown={(e) => onDown(e, id)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
            <IconGrip />
          </span>
        </div>
      ))}
    </div>
  );
}
