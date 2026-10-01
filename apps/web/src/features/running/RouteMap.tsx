import { useT } from "@/i18n";

const W = 330, H = 220, PAD = 16;

/**
 * The route as a line on the card, without map tiles: works offline and sends the location
 * to no third party (docs/design/screens/running.md). Start = ring, finish = filled dot.
 * `marker` shows the point selected in a chart.
 */
export function RouteMap({ coords, marker }: { coords: Array<[number, number]>; marker?: [number, number] | null }) {
  const t = useT();
  if (coords.length < 2) return null;
  const meanLat = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const k = Math.cos((meanLat * Math.PI) / 180);
  const xs = coords.map((c) => c[1] * k), ys = coords.map((c) => -c[0]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = Math.min((W - 2 * PAD) / (maxX - minX || 1e-9), (H - 2 * PAD) / (maxY - minY || 1e-9));
  const offX = (W - (maxX - minX) * scale) / 2, offY = (H - (maxY - minY) * scale) / 2;
  const P = (lat: number, lon: number) => [offX + (lon * k - minX) * scale, offY + (-lat - minY) * scale] as const;
  const d = coords.map(([lat, lon], i) => { const [x, y] = P(lat, lon); return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`; }).join(" ");
  const [sx, sy] = P(...coords[0]!);
  const [ex, ey] = P(...coords[coords.length - 1]!);
  const m = marker ? P(...marker) : null;

  return (
    <svg className="route" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t.running.route}>
      <path className="route-ln" d={d} />
      <circle className="route-start" cx={sx} cy={sy} r={5.5} />
      <circle className="route-end" cx={ex} cy={ey} r={5} />
      {m && <circle className="sel" cx={m[0]} cy={m[1]} r={6} />}
    </svg>
  );
}
