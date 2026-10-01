import { formatNumber, type FormatPrefs } from "./format";

/**
 * Running maths (docs/design/screens/running.md). Pure functions on SI units:
 * metres, seconds, degrees. Formatting helpers at the bottom.
 */

export interface TrackPoint {
  lat: number;
  lon: number;
  /** Seconds since the start of the run. */
  t: number;
  ele: number | null;
  hr: number | null;
}

/* ---------- Geometry ---------- */

const EARTH_R = 6_371_008.8;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Distance from the start at every point. */
export function cumulativeDistances(points: Array<{ lat: number; lon: number }>): number[] {
  const out: number[] = [];
  let d = 0;
  for (let i = 0; i < points.length; i++) {
    if (i) d += haversine(points[i - 1]!, points[i]!);
    out.push(d);
  }
  return out;
}

/* ---------- Polyline encoding (Google algorithm, 1e-5° precision ≈ 1 m) ---------- */

function encodeValue(v: number): string {
  let n = v < 0 ? ~(v << 1) : v << 1;
  let s = "";
  while (n >= 0x20) {
    s += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
    n >>= 5;
  }
  return s + String.fromCharCode(n + 63);
}

export function encodePolyline(coords: Array<[lat: number, lon: number]>): string {
  let pLat = 0, pLon = 0, out = "";
  for (const [lat, lon] of coords) {
    const iLat = Math.round(lat * 1e5), iLon = Math.round(lon * 1e5);
    out += encodeValue(iLat - pLat) + encodeValue(iLon - pLon);
    pLat = iLat;
    pLon = iLon;
  }
  return out;
}

export function decodePolyline(s: string): Array<[lat: number, lon: number]> {
  const out: Array<[number, number]> = [];
  let i = 0, lat = 0, lon = 0;
  const next = () => {
    let shift = 0, result = 0, b: number;
    do {
      b = s.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20 && i < s.length);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < s.length) {
    lat += next();
    lon += next();
    out.push([lat / 1e5, lon / 1e5]);
  }
  return out;
}

/* ---------- Track processing ---------- */

/** Keeps about one point per `everyS` seconds (always the first and last), at most `max` points. */
export function downsampleTrack<T extends { t: number }>(points: T[], everyS = 5, max = 10_000): T[] {
  if (points.length <= 2) return points;
  const span = points[points.length - 1]!.t - points[0]!.t;
  const step = Math.max(everyS, span / max);
  const out: T[] = [points[0]!];
  for (let i = 1; i < points.length - 1; i++) {
    if (points[i]!.t - out[out.length - 1]!.t >= step) out.push(points[i]!);
  }
  out.push(points[points.length - 1]!);
  return out;
}

/** Below this speed a segment counts as standing (≈ 20:50 /km; slower than any walk). */
const MOVING_MIN_SPEED = 0.8;
/** Gaps longer than this (device paused, signal lost) never count as moving. */
const MAX_GAP_S = 60;
/** Elevation changes smaller than this are treated as GPS/barometer noise. */
const ELE_NOISE_M = 3;

export function movingTime(dist: number[], t: number[]): number {
  let s = 0;
  for (let i = 1; i < t.length; i++) {
    const dt = t[i]! - t[i - 1]!;
    if (dt <= 0 || dt > MAX_GAP_S) continue;
    if ((dist[i]! - dist[i - 1]!) / dt >= MOVING_MIN_SPEED) s += dt;
  }
  return Math.round(s);
}

/** Total ascent with a noise threshold (hysteresis), in metres. */
export function elevationGain(ele: Array<number | null>): number | null {
  const vals = ele.filter((e): e is number => e !== null);
  if (vals.length < 2) return null;
  let gain = 0, anchor = vals[0]!;
  for (const e of vals) {
    if (e - anchor >= ELE_NOISE_M) { gain += e - anchor; anchor = e; }
    else if (anchor - e >= ELE_NOISE_M) anchor = e;
  }
  return Math.round(gain);
}

export function hrStats(hr: Array<number | null>): { avg: number | null; max: number | null } {
  const vals = hr.filter((h): h is number => h !== null && h > 0);
  if (!vals.length) return { avg: null, max: null };
  return { avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length), max: Math.max(...vals) };
}

export interface TrackSummary {
  distanceM: number;
  movingTimeS: number;
  elapsedS: number;
  elevationGainM: number | null;
  avgHr: number | null;
  maxHr: number | null;
}

export function summarizeTrack(points: TrackPoint[]): TrackSummary {
  const dist = cumulativeDistances(points);
  const t = points.map((p) => p.t);
  const hr = hrStats(points.map((p) => p.hr));
  return {
    distanceM: Math.round(dist[dist.length - 1] ?? 0),
    movingTimeS: movingTime(dist, t),
    elapsedS: Math.round((t[t.length - 1] ?? 0) - (t[0] ?? 0)),
    elevationGainM: elevationGain(points.map((p) => p.ele)),
    avgHr: hr.avg,
    maxHr: hr.max,
  };
}

/* ---------- Splits and best efforts ---------- */

/** Time at distance `d`, interpolated between track points (dist must be ascending). */
function timeAt(dist: number[], t: number[], d: number, from = 0): { time: number; index: number } {
  let i = Math.max(1, from);
  while (i < dist.length && dist[i]! < d) i++;
  if (i >= dist.length) return { time: t[t.length - 1]!, index: dist.length - 1 };
  const d0 = dist[i - 1]!, d1 = dist[i]!;
  const f = d1 > d0 ? (d - d0) / (d1 - d0) : 0;
  return { time: t[i - 1]! + f * (t[i]! - t[i - 1]!), index: i };
}

export interface Split {
  /** 1-based split number. */
  n: number;
  distanceM: number;
  timeS: number;
  /** Elevation change over the split, or null without elevation data. */
  eleDeltaM: number | null;
}

/**
 * Per-kilometre (or other length) splits, the last one partial. Uses elapsed time within each split,
 * like the watch does for auto laps.
 */
export function splits(dist: number[], t: number[], ele: Array<number | null> | null = null, every = 1000): Split[] {
  const total = dist[dist.length - 1] ?? 0;
  if (total <= 0) return [];
  const out: Split[] = [];
  let prev = { time: t[0]!, index: 0 };
  let prevEle = ele?.[0] ?? null;
  for (let n = 1; (n - 1) * every < total - 1; n++) {
    const end = Math.min(n * every, total);
    const at = timeAt(dist, t, end, prev.index);
    const e = ele ? ele[Math.min(at.index, ele.length - 1)] ?? null : null;
    out.push({ n, distanceM: end - (n - 1) * every, timeS: at.time - prev.time, eleDeltaM: e !== null && prevEle !== null ? Math.round(e - prevEle) : null });
    prev = at;
    prevEle = e;
  }
  // A tiny tail (< 50 m) is noise at the finish: merge it into the previous split.
  const last = out[out.length - 1];
  if (out.length > 1 && last && last.distanceM < 50) {
    out.pop();
    const p = out[out.length - 1]!;
    out[out.length - 1] = { ...p, distanceM: p.distanceM + last.distanceM, timeS: p.timeS + last.timeS };
  }
  return out;
}

export const BEST_EFFORTS = [
  { key: "400", m: 400, label: "400 m" },
  { key: "1000", m: 1000, label: "1K" },
  { key: "1609", m: 1609.344, label: "1 mile" },
  { key: "5000", m: 5000, label: "5K" },
  { key: "10000", m: 10_000, label: "10K" },
  { key: "21097", m: 21_097.5, label: "Half marathon" },
  { key: "42195", m: 42_195, label: "Marathon" },
] as const;

/**
 * Fastest time for each standard distance anywhere within the track (sliding window, elapsed time,
 * scaled to the exact distance). Returns only distances the run covered.
 */
export function bestEfforts(dist: number[], t: number[]): Record<string, number> {
  const out: Record<string, number> = {};
  const total = dist[dist.length - 1] ?? 0;
  for (const e of BEST_EFFORTS) {
    if (total < e.m) continue;
    let best = Infinity, i = 0;
    for (let j = 1; j < dist.length; j++) {
      while (i + 1 < j && dist[j]! - dist[i + 1]! >= e.m) i++;
      const d = dist[j]! - dist[i]!;
      if (d < e.m) continue;
      const time = ((t[j]! - t[i]!) * e.m) / d;
      if (time > 0 && time < best) best = time;
    }
    if (Number.isFinite(best)) out[e.key] = Math.round(best);
  }
  return out;
}

/** Best efforts for a manual run: only the distance it matches (within 1 %), e.g. a 5.00 km race. */
export function manualEfforts(distanceM: number, timeS: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of BEST_EFFORTS) if (Math.abs(distanceM - e.m) <= e.m * 0.01 && timeS > 0) out[e.key] = Math.round((timeS * e.m) / distanceM);
  return out;
}

/**
 * A smoothed series along the run for charts: one value per `stepM` metres.
 * Pace uses the elapsed time over a window of `windowM` metres around each point.
 */
export function paceSeries(dist: number[], t: number[], stepM = 100, windowM = 400): Array<{ d: number; secPerKm: number }> {
  const total = dist[dist.length - 1] ?? 0;
  const out: Array<{ d: number; secPerKm: number }> = [];
  for (let d = Math.min(windowM / 2, total); d <= total; d += stepM) {
    const a = Math.max(0, d - windowM / 2), b = Math.min(total, d + windowM / 2);
    if (b - a < 50) continue;
    const dt = timeAt(dist, t, b).time - timeAt(dist, t, a).time;
    out.push({ d, secPerKm: (dt / (b - a)) * 1000 });
  }
  return out;
}

/** Any per-point value (elevation, heart rate) sampled every `stepM` metres. */
export function seriesByDistance(dist: number[], values: Array<number | null>, stepM = 100): Array<{ d: number; v: number }> {
  const out: Array<{ d: number; v: number }> = [];
  const total = dist[dist.length - 1] ?? 0;
  let i = 0;
  for (let d = 0; d <= total; d += stepM) {
    while (i < dist.length - 1 && dist[i]! < d) i++;
    const v = values[i];
    if (v !== null && v !== undefined && v > 0) out.push({ d, v });
  }
  return out;
}

/* ---------- Formatting ---------- */

/** Seconds per km, from a distance and time. */
export const paceOf = (distanceM: number, timeS: number): number | null => (distanceM > 0 && timeS > 0 ? (timeS / distanceM) * 1000 : null);

/** "5:12" (min:sec per km). */
export function formatPace(secPerKm: number): string {
  const s = Math.round(secPerKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** "10.02" km with two decimals (one above 100 km). */
export function formatDistanceValue(m: number, prefs: Pick<FormatPrefs, "decimalSeparator">): string {
  const km = m / 1000;
  const [int = "0", dec = ""] = (km >= 100 ? km.toFixed(1) : km.toFixed(2)).split(".");
  return formatNumber(Number(int), prefs, 0) + (prefs.decimalSeparator === "comma" ? "," : ".") + dec;
}

/** "52:14", "1:02:03" — run times always show seconds. */
export function formatRunTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** Parses "10.5", "10,5" (km) → metres, or null when invalid. */
export function parseDistanceInput(input: string): number | null {
  const s = input.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const km = Number(s);
  return km > 0 && km <= 1000 ? Math.round(km * 1000) : null;
}

/** Parses "52:14", "1:02:03" or "45" (minutes) → seconds, or null when invalid. */
export function parseRunTimeInput(input: string): number | null {
  const s = input.trim();
  if (/^\d+$/.test(s)) { const m = Number(s); return m > 0 && m < 10_000 ? m * 60 : null; }
  const parts = s.split(":");
  if (parts.length < 2 || parts.length > 3 || !parts.every((p) => /^\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  if (nums.slice(1).some((n) => n > 59)) return null;
  const secs = nums.length === 3 ? nums[0]! * 3600 + nums[1]! * 60 + nums[2]! : nums[0]! * 60 + nums[1]!;
  return secs > 0 && secs < 7 * 86_400 ? secs : null;
}
