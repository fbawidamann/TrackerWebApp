import { useRef, type PointerEvent } from "react";

export interface Bar { label: string; value: number }

const W = 330, H = 170, L = 34, R = 8, T = 12, B = 24;

/**
 * Minimal SVG bar chart (weekly running distance): one accent series, rounded tops anchored to the baseline,
 * 2 px gaps, faint grid. Tap/drag selects a bar; the parent shows the readout.
 */
export function BarChart({ bars, steps, format, selected, onSelect, label, labelEvery = 3 }: {
  bars: Bar[]; steps: number[]; format: (v: number) => string; selected: number; onSelect: (i: number) => void;
  label: string; labelEvery?: number;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const scrubbing = useRef(false);
  const max = Math.max(0, ...bars.map((b) => b.value));
  const step = steps.find((s) => max / s <= 4) ?? steps[steps.length - 1]!;
  const top = Math.max(step, Math.ceil(max / step) * step);
  const slot = (W - L - R) / bars.length;
  const bw = Math.max(2, slot - 2);
  const Y = (v: number) => T + (1 - v / top) * (H - T - B);
  const grid: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) grid.push(v);

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const x = ((e.clientX - r.left) / r.width) * W;
    onSelect(Math.min(bars.length - 1, Math.max(0, Math.floor((x - L) / slot))));
  };

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}
      onPointerDown={(e) => { scrubbing.current = true; pick(e); }}
      onPointerMove={(e) => { if (scrubbing.current || e.pointerType === "mouse") pick(e); }}
      onPointerUp={() => { scrubbing.current = false; }} onPointerLeave={() => { scrubbing.current = false; }}>
      {grid.map((v) => (
        <g key={v}>
          <line className="gl" x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} />
          <text className="tx" x={L - 6} y={Y(v) + 4} textAnchor="end">{format(v)}</text>
        </g>
      ))}
      {bars.map((b, i) => {
        const x = L + i * slot + 1, y = Y(b.value), h = H - B - y;
        const r = Math.min(4, bw / 2, h);
        return (
          <g key={i}>
            {b.value > 0 && (
              <path className={"bar" + (i === selected ? " on" : "")}
                d={`M${x} ${H - B}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + bw - r}Q${x + bw} ${y} ${x + bw} ${y + r}V${H - B}Z`} />
            )}
            {(bars.length - 1 - i) % labelEvery === 0 && <text className="tx" x={x + bw / 2} y={H - 6} textAnchor="middle">{b.label}</text>}
          </g>
        );
      })}
    </svg>
  );
}
