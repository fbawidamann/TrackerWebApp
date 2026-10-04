import type { ProteinStatus } from "@fitness/shared";
import type { DayDot } from "@/lib/nutrition";
import { useT } from "@/i18n";
import { useFormat } from "@/lib/useFormat";

/**
 * The protein ring (Florian 2026-10-04): fill = protein / target, colour = how good the day is.
 * red < 50 %, yellow < 80 %, green < 100 %, dark green ≥ 100 %. Colours are fixed (not the accent), so they always
 * mean the same. Text in the middle: grams of protein; below: "of 145 g".
 */
export function ProteinRing({ protein, target, status, size = 168 }: { protein: number; target: number; status: ProteinStatus; size?: number }) {
  const t = useT();
  const n = t.nutrition;
  const fmt = useFormat();
  const r = 42, c = 2 * Math.PI * r;
  const frac = target > 0 ? Math.min(1, protein / target) : 0;
  const p = fmt.num(Math.round(protein), 0), tg = fmt.num(target, 0);
  return (
    <div className={`pring ps-${status}${size < 100 ? " mini" : ""}`} style={{ width: size, height: size }} role="img" aria-label={n.ringAria(p, tg, n.status[status])}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={r} className="pring-bg" />
        <circle cx="50" cy="50" r={r} className="pring-fg" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} transform="rotate(-90 50 50)" />
      </svg>
      <div className="pring-txt" aria-hidden="true">
        <b>{p}<small> g</small></b>
        <span>{n.of} {tg} g</span>
        <span className="pring-status">{n.status[status]}</span>
      </div>
    </div>
  );
}

/** Seven small dots (last 7 days), same colours as the ring. Tap selects the day. */
export function ProteinWeek({ days, selected, onSelect }: { days: DayDot[]; selected: Date; onSelect: (d: Date) => void }) {
  const t = useT();
  const fmt = useFormat();
  return (
    <ol className="pweek" aria-label={t.nutrition.last7}>
      {days.map((d) => {
        const on = d.date.toDateString() === selected.toDateString();
        return (
          <li key={d.date.toISOString()}>
            <button type="button" className={`pday ps-${d.status}${on ? " on" : ""}${d.isToday ? " today" : ""}`} disabled={d.isFuture}
              aria-pressed={on} aria-label={t.nutrition.dayAria(fmt.weekday(d.date), fmt.num(Math.round(d.protein), 0), t.nutrition.status[d.status])}
              onClick={() => onSelect(d.date)}>
              <span className="pday-l" aria-hidden="true">{fmt.weekday(d.date).slice(0, 2)}</span>
              <i aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ol>
  );
}
