import { describe, expect, it } from "vitest";
import {
  bestEfforts, cumulativeDistances, decodePolyline, downsampleTrack, elevationGain, encodePolyline, formatDistanceValue,
  formatPace, formatRunTime, haversine, manualEfforts, movingTime, paceOf, parseDistanceInput, parseRunTimeInput, splits,
  summarizeTrack, type TrackPoint,
} from "./running";

/** A straight run due north at a constant speed: one point per second. */
function straightRun(meters: number, secPerKm: number, startLat = 48.1): TrackPoint[] {
  const degPerM = 1 / 111_194.9; // metres per degree of latitude on the mean-radius sphere
  const pts: TrackPoint[] = [];
  const total = Math.round((meters / 1000) * secPerKm);
  for (let t = 0; t <= total; t++) pts.push({ lat: startLat + (t / total) * meters * degPerM, lon: 11.5, t, ele: null, hr: null });
  return pts;
}

describe("geometry", () => {
  it("measures one degree of latitude as ~111 km", () => {
    expect(haversine({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(111_195, -1);
  });
  it("round-trips the polyline encoding at 1e-5°", () => {
    const coords: Array<[number, number]> = [[38.5, -120.2], [40.7, -120.95], [43.252, -126.453], [48.13743, 11.57549]];
    expect(encodePolyline(coords.slice(0, 3))).toBe("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    decodePolyline(encodePolyline(coords)).forEach(([lat, lon], i) => {
      expect(lat).toBeCloseTo(coords[i]![0], 5);
      expect(lon).toBeCloseTo(coords[i]![1], 5);
    });
  });
});

describe("track summary", () => {
  it("computes distance and moving time of a steady 5 km run", () => {
    const s = summarizeTrack(straightRun(5000, 300));
    expect(s.distanceM).toBeGreaterThan(4990);
    expect(s.distanceM).toBeLessThan(5010);
    expect(s.movingTimeS).toBe(1500);
    expect(s.elevationGainM).toBeNull();
  });
  it("drops standing still and long pauses from moving time", () => {
    const dist = [0, 3, 6, 6, 6, 9];
    const t = [0, 1, 2, 12, 200, 201];
    expect(movingTime(dist, t)).toBe(3);
  });
  it("ignores elevation noise below 3 m", () => {
    expect(elevationGain([100, 101, 100, 102, 101, 110, 108, 115])).toBe(15);
    expect(elevationGain([null, 5])).toBeNull();
  });
  it("downsamples to one point per 5 s and keeps the ends", () => {
    const pts = straightRun(1000, 300);
    const d = downsampleTrack(pts);
    expect(d[0]).toBe(pts[0]);
    expect(d[d.length - 1]).toBe(pts[pts.length - 1]);
    expect(d.length).toBe(61);
  });
});

describe("splits and efforts", () => {
  it("splits per km with a partial last split", () => {
    const pts = straightRun(2500, 300);
    const dist = cumulativeDistances(pts);
    const s = splits(dist, pts.map((p) => p.t));
    expect(s.map((x) => x.n)).toEqual([1, 2, 3]);
    expect(s[0]!.timeS).toBeCloseTo(300, 0);
    expect(s[2]!.distanceM).toBeCloseTo(500, -1);
    expect(s[2]!.timeS).toBeCloseTo(150, -1);
  });
  it("finds the fastest window inside a run", () => {
    // 2 km at 6:00 /km, then 1 km at 4:00 /km
    const slow = straightRun(2000, 360);
    const fast = straightRun(1000, 240, slow[slow.length - 1]!.lat).map((p) => ({ ...p, t: p.t + 720 }));
    const pts = [...slow, ...fast.slice(1)];
    const e = bestEfforts(cumulativeDistances(pts), pts.map((p) => p.t));
    expect(e["1000"]).toBeGreaterThanOrEqual(239);
    expect(e["1000"]).toBeLessThanOrEqual(241);
    expect(e["5000"]).toBeUndefined();
  });
  it("counts manual runs only at matching distances", () => {
    expect(manualEfforts(5000, 1500)).toEqual({ "5000": 1500 });
    expect(manualEfforts(7300, 2400)).toEqual({});
  });
});

describe("running formats", () => {
  it("formats pace, distance and time", () => {
    expect(formatPace(paceOf(10_000, 3125)!)).toBe("5:13");
    expect(formatDistanceValue(10_020, { decimalSeparator: "point" })).toBe("10.02");
    expect(formatDistanceValue(5000, { decimalSeparator: "comma" })).toBe("5,00");
    expect(formatRunTime(3723)).toBe("1:02:03");
    expect(formatRunTime(1534)).toBe("25:34");
  });
  it("parses distance and time input", () => {
    expect(parseDistanceInput("10,5")).toBe(10_500);
    expect(parseDistanceInput("abc")).toBeNull();
    expect(parseRunTimeInput("52:14")).toBe(3134);
    expect(parseRunTimeInput("1:02:03")).toBe(3723);
    expect(parseRunTimeInput("45")).toBe(2700);
    expect(parseRunTimeInput("5:75")).toBeNull();
  });
});
