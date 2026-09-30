/**
 * End-to-end sync: the real web sync engine (Dexie on fake-indexeddb) talks to this server (PGlite)
 * through a fetch shim. Two "devices" of the same user exchange data.
 */
import { builtinExerciseId } from "@fitness/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deleteWorkout, finishWorkout, saveRoutine, startWorkout, updateSet, updateSettings } from "@/db/actions";
import { db, FitnessDb, setDb } from "@/db/db";
import { setOwner } from "@/db/owner";
import { ensureSettings } from "@/db/seed";
import { buildTraining } from "@/lib/training";
import { getAccount, login, logout } from "@/sync/account";
import { pendingCount, syncNow } from "@/sync/engine";
import { createApp } from "./app";
import { LoginLimiter } from "./auth/rateLimit";
import { openDatabase, type Database } from "./db/client";
import { createUser } from "./users";

const BENCH = builtinExerciseId("Barbell_Bench_Press_-_Medium_Grip");

let database: Database;
let app: ReturnType<typeof createApp>;

interface Device { name: string; db: FitnessDb; cookie: string }
let current: Device;
let n = 0;

function device(name: string): Device {
  return { name, db: new FitnessDb(`device-${name}-${++n}`), cookie: "" };
}
async function use(d: Device) {
  current = d;
  setDb(d.db);
  setOwner((await getAccount())?.userId ?? null);
  await ensureSettings();
}

beforeAll(async () => {
  database = await openDatabase();
  app = createApp({ db: database.db, limiter: new LoginLimiter(), secureCookies: false, allowedOrigins: [] });
  await createUser(database.db, "LegendFLOO", "Admin123!", "admin");
  // fetch shim: routes the web app's same-origin requests to the Hono app, with a cookie jar per device.
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.pathname + input.search : input.url;
    const headers = new Headers(init?.headers);
    if (current.cookie) headers.set("cookie", current.cookie);
    const res = await app.request(url, { ...init, headers });
    const set = res.headers.get("set-cookie");
    if (set) current.cookie = /Max-Age=0|expires=Thu, 01 Jan 1970/i.test(set) ? "" : set.split(";")[0]!;
    return res;
  }) as typeof fetch;
});
afterAll(async () => { await database.close(); });

async function logWorkout(weight: number) {
  const routineId = (await db.routines.toArray())[0]?.id
    ?? await saveRoutine(null, "Push", [{ exerciseId: BENCH, warmupSets: 0, workingSets: 1, note: "" }]);
  const id = await startWorkout({ routineId });
  const set = (await db.sets.where("activityId").equals(id).toArray())[0]!;
  await updateSet(set.id, { weightKg: weight, reps: 8, completedAt: new Date().toISOString() });
  await finishWorkout(id);
  return id;
}
async function workouts() {
  return buildTraining(await db.activities.toArray(), await db.activityExercises.toArray(), await db.sets.toArray(), false).workouts;
}

describe("sync between devices", () => {
  const phone = device("phone");
  const pc = device("pc");
  let firstId = "";

  it("uploads data logged before the first login into the account", async () => {
    await use(phone);
    await updateSettings({ weeklyGoal: 5 });
    firstId = await logWorkout(80);
    expect(await pendingCount()).toBeGreaterThan(0);
    await login("LegendFLOO", "Admin123!");
    expect(await pendingCount()).toBe(0);
    const acts = await db.activities.toArray();
    expect(acts.every((a) => a.userId !== "local")).toBe(true);
  });

  it("a second device gets everything, and the account settings win over its defaults", async () => {
    await use(pc);
    expect(await workouts()).toHaveLength(0);
    await login("legendfloo", "Admin123!");
    const list = await workouts();
    expect(list).toHaveLength(1);
    expect(list[0]!.exercises[0]!.sets[0]!.weightKg).toBe(80);
    expect((await db.settings.get("user"))?.weeklyGoal).toBe(5);
  });

  it("new workouts and edits flow both ways", async () => {
    await use(pc);
    await logWorkout(82.5);
    await syncNow();
    await use(phone);
    await syncNow();
    const list = await workouts();
    expect(list).toHaveLength(2);
    expect(list.some((w) => w.prCount === 1)).toBe(true); // 82.5 beats 80 → PR also on the phone
  });

  it("the newest edit wins", async () => {
    await use(phone);
    const setId = (await db.sets.where("activityId").equals(firstId).toArray())[0]!.id;
    await updateSet(setId, { reps: 9 });
    await use(pc);
    await new Promise((r) => setTimeout(r, 5));
    await updateSet(setId, { reps: 10 }); // later edit on the PC
    await syncNow();
    await use(phone);
    await syncNow(); // phone pushes its older edit (ignored by the server), then pulls the newer one
    expect((await db.sets.get(setId))?.reps).toBe(10);
  });

  it("deletes propagate", async () => {
    await use(pc);
    await deleteWorkout(firstId);
    await syncNow();
    await use(phone);
    await syncNow();
    expect((await workouts()).map((w) => w.activity.id)).not.toContain(firstId);
  });

  it("logout wipes the device, and nothing is lost on the server", async () => {
    await use(phone);
    await logout();
    expect(await getAccount()).toBeNull();
    expect(await db.activities.count()).toBe(0);
    await login("LegendFLOO", "Admin123!");
    expect((await workouts()).length).toBe(1);
  });
});
