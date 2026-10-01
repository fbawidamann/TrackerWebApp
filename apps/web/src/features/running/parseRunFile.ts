import type { TrackPoint, TrackSummary } from "@fitness/shared";
import type { ParsedRunFile } from "@/db/actions";
import { tr } from "@/i18n";

/** Reads a GPX or FIT file exported from a watch, Garmin Connect or Strava (docs/design/screens/running.md). */
export async function parseRunFile(file: File): Promise<ParsedRunFile> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".fit")) return parseFit(await file.arrayBuffer());
  if (name.endsWith(".gpx")) return parseGpx(await file.text());
  throw new Error(tr().running.errChooseFile);
}

const num = (s: string | null | undefined): number | null => {
  if (s === null || s === undefined || s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

export function parseGpx(xml: string): ParsedRunFile {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error(tr().running.errGpx);
  const pts = Array.from(doc.getElementsByTagName("trkpt"));
  if (pts.length < 2) throw new Error(tr().running.errNoTrack);

  const raw: Array<{ lat: number; lon: number; time: number; ele: number | null; hr: number | null }> = [];
  for (const p of pts) {
    const lat = num(p.getAttribute("lat")), lon = num(p.getAttribute("lon"));
    const time = Date.parse(p.getElementsByTagName("time")[0]?.textContent ?? "");
    if (lat === null || lon === null || Number.isNaN(time)) continue;
    // Heart rate sits in a namespaced extension (gpxtpx:hr, ns3:hr …): match on the local name.
    const hrEl = Array.from(p.getElementsByTagName("*")).find((e) => e.localName === "hr");
    raw.push({ lat, lon, time, ele: num(p.getElementsByTagName("ele")[0]?.textContent), hr: num(hrEl?.textContent) });
  }
  if (raw.length < 2) throw new Error(tr().running.errNoTimes);
  raw.sort((a, b) => a.time - b.time);
  const t0 = raw[0]!.time;
  const trkName = doc.getElementsByTagName("trk")[0]?.getElementsByTagName("name")[0]?.textContent ?? null;
  return {
    source: "gpx",
    name: trkName,
    startedAt: new Date(t0),
    points: raw.map((r) => ({ lat: r.lat, lon: r.lon, t: (r.time - t0) / 1000, ele: r.ele, hr: r.hr })),
    totals: {},
  };
}

const SEMI = 180 / 2 ** 31;

interface FitRecord { timestamp?: Date; positionLat?: number; positionLong?: number; enhancedAltitude?: number; altitude?: number; heartRate?: number }
interface FitSession {
  startTime?: Date; totalDistance?: number; totalTimerTime?: number; totalElapsedTime?: number;
  totalAscent?: number; avgHeartRate?: number; maxHeartRate?: number;
}

export async function parseFit(buffer: ArrayBuffer): Promise<ParsedRunFile> {
  // Loaded only when a FIT file is imported, so the SDK stays out of the main bundle.
  const { Decoder, Stream } = await import("@garmin/fitsdk");
  const decoder = new Decoder(Stream.fromArrayBuffer(buffer));
  if (!decoder.isFIT()) throw new Error(tr().running.errNotFit);
  const { messages } = decoder.read() as unknown as { messages: { recordMesgs?: FitRecord[]; sessionMesgs?: FitSession[] } };
  const records = (messages.recordMesgs ?? []).filter((r) => r.timestamp);
  const session = messages.sessionMesgs?.[0];
  const start = session?.startTime ?? records[0]?.timestamp;
  if (!start) throw new Error(tr().running.errFitEmpty);

  const t0 = start.getTime();
  const points: TrackPoint[] = records
    .filter((r) => r.positionLat !== undefined && r.positionLong !== undefined)
    .map((r) => ({
      lat: r.positionLat! * SEMI, lon: r.positionLong! * SEMI, t: (r.timestamp!.getTime() - t0) / 1000,
      ele: r.enhancedAltitude ?? r.altitude ?? null, hr: r.heartRate ?? null,
    }));

  const totals: Partial<TrackSummary> = {};
  if (session?.totalDistance) totals.distanceM = session.totalDistance;
  if (session?.totalTimerTime) totals.movingTimeS = session.totalTimerTime;
  if (session?.totalElapsedTime) totals.elapsedS = session.totalElapsedTime;
  if (session?.totalAscent !== undefined) totals.elevationGainM = session.totalAscent;
  if (session?.avgHeartRate) totals.avgHr = session.avgHeartRate;
  if (session?.maxHeartRate) totals.maxHr = session.maxHeartRate;
  if (!points.length && !totals.distanceM) throw new Error(tr().running.errFitNoData);

  return { source: "fit", name: null, startedAt: start, points, totals };
}
