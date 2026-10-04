/** Tiny trend line (e.g. e1RM over the last sessions): one accent line, the latest point as a dot. Needs ≥ 2 values. */
export function Sparkline({ values, label, w = 64, h = 24 }: { values: number[]; label: string; w?: number; h?: number }) {
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pad = 3;
  const pts = values.map((v, i) => [pad + (i / (values.length - 1)) * (w - 2 * pad), max === min ? h / 2 : pad + (1 - (v - min) / span) * (h - 2 * pad)] as const);
  const last = pts[pts.length - 1]!;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={label}>
      <polyline points={pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")} />
      <circle cx={last[0]} cy={last[1]} r={2.5} />
    </svg>
  );
}
