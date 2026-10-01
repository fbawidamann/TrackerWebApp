import { useRef, type PointerEvent } from "react";

export interface TrackPointXY { d: number; v: number }

const W = 330, H = 150, L = 40, R = 10, T = 10, B = 24;

/**
 * One value along a run (pace, elevation, heart rate) against distance in km. One series, one axis.
 * `invert` puts low values on top (faster pace = higher). `area` adds a flat, faint fill (elevation).
 * Tap/drag selects a point; the parent shows the readout.
 */
export function TrackChart({ points, format, steps, invert = false, area = false, selected, onSelect, label, kmLabel }: {
  points: TrackPointXY[]; format: (v: number) => string; steps: number[]; invert?: boolean; area?: boolean;
  selected: number | null; onSelect: (i: number | null) => void; label: string; kmLabel: (km: number) => string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const scrubbing = useRef(false);
  if (points.length < 2) return null;

  const vals = points.map((p) => p.v);
  // Clip outliers (GPS glitches, standing still) so they don't flatten the rest of the chart.
  const sorted = [...vals].sort((a, b) => a - b);
  let min = sorted[Math.floor(sorted.length * 0.02)]!, max = sorted[Math.ceil(sorted.length * 0.98) - 1]!;
  if (max - min < steps[0]!) { min -= steps[0]!; max += steps[0]!; }
  const step = steps.find((s) => (max - min) / s <= 4) ?? steps[steps.length - 1]!;
  const y0 = Math.floor(min / step) * step, y1 = Math.ceil(max / step) * step;
  const dMax = points[points.length - 1]!.d || 1;
  const X = (d: number) => L + (d / dMax) * (W - L - R);
  const Y = (v: number) => {
    const c = Math.min(y1, Math.max(y0, v));
    const f = (c - y0) / (y1 - y0 || 1);
    return T + (invert ? f : 1 - f) * (H - T - B);
  };
  const grid: number[] = [];
  for (let v = y0; v <= y1 + 1e-9; v += step) grid.push(v);
  const kmStep = [1, 2, 5, 10, 20].find((s) => dMax / 1000 / s <= 6) ?? 50;
  const ticks: number[] = [];
  for (let k = kmStep; k * 1000 < dMax; k += kmStep) ticks.push(k);

  const line = points.map((p, i) => `${i ? "L" : "M"}${X(p.d).toFixed(1)} ${Y(p.v).toFixed(1)}`).join(" ");
  const fill = `${line} L${X(dMax).toFixed(1)} ${H - B} L${L} ${H - B} Z`;
  const sel = selected !== null ? points[Math.min(selected, points.length - 1)] : undefined;

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const d = (((e.clientX - r.left) / r.width) * W - L) / (W - L - R) * dMax;
    let best = 0, bd = Infinity;
    points.forEach((p, i) => { const x = Math.abs(p.d - d); if (x < bd) { bd = x; best = i; } });
    onSelect(best);
  };

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}
      onPointerDown={(e) => { scrubbing.current = true; pick(e); }}
      onPointerMove={(e) => { if (scrubbing.current || e.pointerType === "mouse") pick(e); }}
      onPointerUp={() => { scrubbing.current = false; }}
      onPointerLeave={(e) => { scrubbing.current = false; if (e.pointerType === "mouse") onSelect(null); }}>
      {grid.map((v) => (
        <g key={v}>
          <line className="gl" x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} />
          <text className="tx" x={L - 6} y={Y(v) + 4} textAnchor="end">{format(v)}</text>
        </g>
      ))}
      {ticks.map((k) => <text key={k} className="tx" x={X(k * 1000)} y={H - 6} textAnchor="middle">{kmLabel(k)}</text>)}
      {area && <path className="area" d={fill} />}
      <path className="ln" d={line} />
      {sel && (
        <>
          <line className="guide" x1={X(sel.d)} x2={X(sel.d)} y1={T} y2={H - B} />
          <circle className="sel" cx={X(sel.d)} cy={Y(sel.v)} r={5} />
        </>
      )}
    </svg>
  );
}
