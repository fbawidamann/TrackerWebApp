/**
 * Imports the free-exercise-db catalog (Unlicense / public domain) into packages/shared/data/exercises.json.
 * See docs/adr/0003-exercise-catalog.md for the mapping rules.
 *
 *   npm run catalog:import           → regenerate data/exercises.json
 *   npm run catalog:images           → download images into apps/web/public/exercise-images (gitignored)
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { builtinExerciseId } from "../src/ids";
import { EQUIPMENT, LEVELS, MUSCLES, type Equipment, type Muscle, type TrackingType } from "../src/schemas";

const SOURCE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const IMAGE_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";
const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, "../data/exercises.json");
const IMAGE_DIR = resolve(here, "../../../apps/web/public/exercise-images");

interface SourceExercise {
  id: string;
  name: string;
  level: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images: string[];
}

export interface CatalogExercise {
  id: string;
  slug: string;
  name: string;
  primaryMuscle: Muscle;
  secondaryMuscles: Muscle[];
  equipment: Equipment;
  trackingType: TrackingType;
  level: (typeof LEVELS)[number] | null;
  instructions: string[];
  images: string[];
}

const EQUIPMENT_MAP: Record<string, Equipment> = {
  barbell: "barbell", "e-z curl bar": "barbell", dumbbell: "dumbbell", machine: "machine", cable: "cable",
  "body only": "bodyweight", kettlebells: "kettlebell", bands: "band",
};

const WEIGHTED_CATEGORIES = new Set(["strength", "powerlifting", "olympic weightlifting", "strongman"]);
const LEADING_EQUIPMENT = /^(barbell|dumbbell|cable|machine|kettlebell|band)\s+/i;

const isMuscle = (m: string): m is Muscle => (MUSCLES as readonly string[]).includes(m);

function mapExercise(src: SourceExercise): CatalogExercise | null {
  const muscles = src.primaryMuscles.filter(isMuscle);
  const primary = muscles[0];
  if (!primary) return null;
  const equipment: Equipment = (src.equipment && EQUIPMENT_MAP[src.equipment]) || "other";
  if (!(EQUIPMENT as readonly string[]).includes(equipment)) return null;
  const secondary = [...muscles.slice(1), ...src.secondaryMuscles.filter(isMuscle)].filter((m, i, a) => m !== primary && a.indexOf(m) === i);

  let trackingType: TrackingType = "duration";
  if (WEIGHTED_CATEGORIES.has(src.category)) trackingType = equipment === "bodyweight" ? "reps_only" : "weight_reps";

  // "Dumbbell Bench Press" → "Bench Press": the equipment is shown on its own line in the UI.
  let name = src.name.trim().replace(/\s+/g, " ");
  const stripped = name.replace(LEADING_EQUIPMENT, "");
  if (stripped.length > 2 && name.match(LEADING_EQUIPMENT)?.[1]?.toLowerCase() === equipment) name = stripped;
  name = name.charAt(0).toUpperCase() + name.slice(1);
  if (name.length > 60) name = name.slice(0, 60).trim();

  const level = src.level && (LEVELS as readonly string[]).includes(src.level) ? (src.level as CatalogExercise["level"]) : null;
  return {
    id: builtinExerciseId(src.id),
    slug: src.id,
    name,
    primaryMuscle: primary,
    secondaryMuscles: secondary,
    equipment,
    trackingType,
    level,
    instructions: src.instructions.map((s) => s.trim()).filter(Boolean),
    images: src.images,
  };
}

async function fetchSource(): Promise<SourceExercise[]> {
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  return (await res.json()) as SourceExercise[];
}

async function importCatalog(): Promise<void> {
  const source = await fetchSource();
  const exercises = source.map(mapExercise).filter((e): e is CatalogExercise => e !== null);
  exercises.sort((a, b) => a.name.localeCompare(b.name) || a.equipment.localeCompare(b.equipment));
  const catalogVersion = createHash("sha1").update(JSON.stringify(exercises)).digest("hex").slice(0, 12);
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify({ catalogVersion, source: "free-exercise-db (Unlicense)", exercises }, null, 1) + "\n");
  // Tiny file the app reads on every start to decide whether to (re)seed, without loading the full catalog.
  await writeFile(join(dirname(OUT), "catalog-version.json"), JSON.stringify({ catalogVersion }) + "\n");
  console.log(`Wrote ${exercises.length} exercises (skipped ${source.length - exercises.length}), version ${catalogVersion}`);
}

async function downloadImages(): Promise<void> {
  const { exercises } = JSON.parse(await readFile(OUT, "utf8")) as { exercises: CatalogExercise[] };
  const paths = exercises.flatMap((e) => e.images);
  let done = 0, skipped = 0, failed = 0;
  const queue = [...paths];
  async function worker(): Promise<void> {
    for (let p = queue.shift(); p !== undefined; p = queue.shift()) {
      const target = join(IMAGE_DIR, p);
      if (existsSync(target)) { skipped++; continue; }
      try {
        const res = await fetch(IMAGE_BASE + p);
        if (!res.ok) throw new Error(String(res.status));
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, Buffer.from(await res.arrayBuffer()));
        done++;
      } catch {
        failed++;
      }
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  console.log(`Images: ${done} downloaded, ${skipped} already present, ${failed} failed → ${IMAGE_DIR}`);
}

if (process.argv.includes("--images-only")) await downloadImages();
else await importCatalog();
