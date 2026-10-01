import { useRef, type PointerEvent } from "react";
import { useT } from "@/i18n";
import { useFormat } from "@/lib/useFormat";

export interface ChartPoint { date: Date; value: number }

const W = 330, H = 190, L = 40, R = 14, T = 14, B = 26;

/**
 * Minimal SVG line chart (docs/design/screens/exercises.md → Progress tab): accent line, points,
 * emphasised latest point, faint grid, month labels. Tap/drag selects the nearest point.
 */
export function LineChart({ points, from, to, steps, format, selected, onSelect, label }: {
  points: ChartPoint[]; from: Date; to: Date; steps: number[]; format: (v: number) => string;
  selected: number; onSelect: (i: number) => void; label: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const scrubbing = useRef(false);
  const fmt = useFormat();
  const t = useT();
  if (!points.length) return <p className="muted" style={{ margin: 0, padding: "24px 12px" }}>{t.exercises.noSessionsInRange}</p>;

  let min = Math.min(...points.map((p) => p.value)), max = Math.max(...points.map((p) => p.value));
  if (min === max) { min -= steps[0]!; max += steps[0]!; }
  const step = steps.find((s) => (max - min) / s <= 4) ?? steps[steps.length - 1]!;
  const y0 = Math.floor(min / step) * step, y1 = Math.ceil(max / step) * step;
  const t0 = from.getTime(), t1 = Math.max(to.getTime(), t0 + 1);
  const X = (t: number) => L + ((t - t0) / (t1 - t0)) * (W - L - R);
  const Y = (v: number) => T + (1 - (v - y0) / (y1 - y0 || 1)) * (H - T - B);

  const grid: Array<{ v: number; y: number }> = [];
  for (let v = y0; v <= y1 + 1e-9; v += step) grid.push({ v, y: Y(v) });
  const months: Array<{ x: number; label: string }> = [];
  for (let d = new Date(from.getFullYear(), from.getMonth() + 1, 1); d <= to; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    months.push({ x: X(d.getTime()), label: fmt.monthAxis(d.getMonth()) });
  }
  const every = Math.max(1, Math.ceil(months.length / 5));
  const path = points.map((p, i) => `${i ? "L" : "M"}${X(p.date.getTime()).toFixed(1)} ${Y(p.value).toFixed(1)}`).join(" ");
  const last = points[points.length - 1]!;
  const sel = points[Math.min(selected, points.length - 1)]!;

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const x = ((e.clientX - r.left) / r.width) * W;
    let best = 0, bd = Infinity;
    points.forEach((p, i) => { const d = Math.abs(X(p.date.getTime()) - x); if (d < bd) { bd = d; best = i; } });
    onSelect(best);
  };

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}
      onPointerDown={(e) => { scrubbing.current = true; pick(e); }}
      onPointerMove={(e) => { if (scrubbing.current || e.pointerType === "mouse") pick(e); }}
      onPointerUp={() => { scrubbing.current = false; }} onPointerLeave={() => { scrubbing.current = false; }}>
      {grid.map((g) => (
        <g key={g.v}>
          <line className="gl" x1={L} x2={W - R} y1={g.y} y2={g.y} />
          <text className="tx" x={L - 8} y={g.y + 4} textAnchor="end">{format(g.v)}</text>
        </g>
      ))}
      {months.map((m, i) => (i % every ? null : <text key={i} className="tx" x={m.x} y={H - 6} textAnchor="middle">{m.label}</text>))}
      <path className="ln" d={path} />
      {points.length <= 30 && points.map((p, i) => <circle key={i} className="pt" cx={X(p.date.getTime())} cy={Y(p.value)} r={2.5} />)}
      <circle className="ring" cx={X(last.date.getTime())} cy={Y(last.value)} r={7} />
      <circle className="pt" cx={X(last.date.getTime())} cy={Y(last.value)} r={4} />
      {sel !== last && (
        <>
          <line className="guide" x1={X(sel.date.getTime())} x2={X(sel.date.getTime())} y1={T} y2={H - B} />
          <circle className="sel" cx={X(sel.date.getTime())} cy={Y(sel.value)} r={5} />
        </>
      )}
    </svg>
  );
}
