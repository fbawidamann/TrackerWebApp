import { beforeEach, describe, expect, it } from "vitest";
import { deleteRun, exportBackup, importBackup, importRun, parseBackup, saveRun, startWorkout } from "@/db/actions";
import { db, FitnessDb, setDb } from "@/db/db";
import { ensureSettings } from "@/db/seed";
import { buildRuns, personalBests, summarize, weeklyDistance } from "@/lib/runStats";
import { buildTraining } from "@/lib/training";
import { parseGpx } from "./parseRunFile";

let n = 0;
beforeEach(async () => {
  setDb(new FitnessDb(`run-test-${++n}`));
  await ensureSettings();
});

/** GPX of a straight 2.2 km run north at 5:00 /km, one point every 2 s, with heart rate in a Garmin extension. */
function gpx(start = "2026-09-28T07:00:00Z"): string {
  const t0 = Date.parse(start);
  const pts: string[] = [];
  for (let s = 0; s <= 660; s += 2) {
    const lat = 48.1 + (s / 300) * 1000 / 111_194.9;
    pts.push(`<trkpt lat="${lat.toFixed(7)}" lon="11.5"><ele>${500 + Math.floor(s / 60)}</ele><time>${new Date(t0 + s * 1000).toISOString()}</time>` +
      `<extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${140 + (s % 20)}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>`);
  }
  return `<?xml version="1.0"?><gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">` +
    `<trk><name>Park loop</name><trkseg>${pts.join("")}</trkseg></trk></gpx>`;
}

const allRuns = async () => buildRuns(await db.activities.toArray(), await db.runs.toArray());

describe("GPX import", () => {
  it("reads points, name, elevation and heart rate", () => {
    const f = parseGpx(gpx());
    expect(f.name).toBe("Park loop");
    expect(f.startedAt.toISOString()).toBe("2026-09-28T07:00:00.000Z");
    expect(f.points).toHaveLength(331);
    expect(f.points[0]).toMatchObject({ t: 0, ele: 500, hr: 140 });
  });
  it("rejects files without a track", () => {
    expect(() => parseGpx(`<gpx xmlns="http://www.topografix.com/GPX/1/1"></gpx>`)).toThrow("no GPS track");
  });
  it("saves the run with totals, efforts and a track, and skips duplicates", async () => {
    const first = await importRun(parseGpx(gpx()));
    expect(first.duplicate).toBe(false);
    const [r] = await allRuns();
    expect(r!.activity.name).toBe("Park loop");
    expect(r!.run.distanceM).toBeGreaterThan(2190);
    expect(r!.run.distanceM).toBeLessThan(2210);
    expect(r!.run.movingTimeS).toBe(660);
    expect(r!.run.avgHr).toBeGreaterThan(140);
    expect(r!.run.elevationGainM).toBe(9);
    expect(r!.run.efforts["1000"]).toBeCloseTo(300, -1);
    expect(r!.run.efforts["5000"]).toBeUndefined();
    const track = await db.runTracks.toArray();
    expect(track).toHaveLength(1);
    expect(track[0]!.t.length).toBeLessThan(150);

    const again = await importRun(parseGpx(gpx()));
    expect(again).toEqual({ activityId: first.activityId, duplicate: true });
    expect(await db.runs.count()).toBe(1);
  });
});

describe("run actions", () => {
  it("logs a manual run and keeps gym data separate", async () => {
    await startWorkout();
    await saveRun({ activityId: null, name: "", startedAt: new Date(2026, 8, 29, 7, 0), distanceM: 5000, movingTimeS: 1500, elevationGainM: null, avgHr: null, notes: "" });
    const runs = await allRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0]!.activity.name).toBe("Morning run");
    expect(runs[0]!.pace).toBe(300);
    expect(runs[0]!.run.efforts).toEqual({ "5000": 1500 });
    // The run is neither a gym workout nor the workout in progress.
    const t = buildTraining(await db.activities.toArray(), await db.activityExercises.toArray(), await db.sets.toArray(), false);
    expect(t.workouts).toHaveLength(0);
  });
  it("edits only name, date and notes of an imported run", async () => {
    const { activityId } = await importRun(parseGpx(gpx()));
    const before = (await allRuns())[0]!;
    await saveRun({ activityId, name: "Sunday", startedAt: new Date("2026-09-28T08:00:00Z"), distanceM: 1, movingTimeS: 1, elevationGainM: null, avgHr: null, notes: "easy" });
    const after = (await allRuns())[0]!;
    expect(after.activity.name).toBe("Sunday");
    expect(after.activity.notes).toBe("easy");
    expect(after.run.distanceM).toBe(before.run.distanceM);
    expect(new Date(after.activity.endedAt!).getTime() - after.start.getTime()).toBe(660_000);
  });
  it("deletes a run with its track, and undo restores it", async () => {
    const { activityId } = await importRun(parseGpx(gpx()));
    const undo = await deleteRun(activityId);
    expect(await allRuns()).toHaveLength(0);
    expect((await db.runTracks.toArray()).every((t) => t.deletedAt !== null)).toBe(true);
    await undo();
    expect(await allRuns()).toHaveLength(1);
  });
  it("writes every run change to the outbox", async () => {
    await importRun(parseGpx(gpx()));
    const tables = new Set((await db.outbox.toArray()).map((e) => e.table).filter((t) => t !== "settings"));
    expect([...tables].sort()).toEqual(["activities", "runTracks", "runs"]);
  });
  it("includes runs in the backup", async () => {
    await importRun(parseGpx(gpx()));
    const parsed = parseBackup(await exportBackup());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.backup.data.runs).toHaveLength(1);
    setDb(new FitnessDb(`run-test-${++n}`));
    await importBackup(parsed.backup);
    expect(await allRuns()).toHaveLength(1);
    expect(await db.runTracks.count()).toBe(1);
  });
});

describe("run stats", () => {
  it("sums periods, buckets weeks and finds personal bests", async () => {
    const mk = (d: Date, m: number, s: number) => saveRun({ activityId: null, name: "", startedAt: d, distanceM: m, movingTimeS: s, elevationGainM: 10, avgHr: null, notes: "" });
    await mk(new Date(2026, 8, 28, 7), 5000, 1500);
    await mk(new Date(2026, 8, 30, 7), 5000, 1450);
    await mk(new Date(2026, 8, 20, 7), 10_000, 3300);
    const runs = await allRuns();
    const s = summarize(runs, new Date(2026, 8, 28));
    expect(s).toMatchObject({ count: 2, distanceM: 10_000, timeS: 2950, elevationM: 20, longestM: 5000 });
    const monday = (d: Date) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
    const weeks = weeklyDistance(runs, monday, new Date(2026, 8, 30), 3);
    // 20 Sep 2026 is a Sunday, so it belongs to the week of 14 Sep.
    expect(weeks.map((w) => w.distanceM)).toEqual([10_000, 0, 10_000]);
    const pbs = personalBests(runs);
    expect(pbs.map((p) => [p.key, p.timeS])).toEqual([["5000", 1450], ["10000", 3300]]);
  });
});
