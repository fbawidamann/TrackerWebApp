import { describe, expect, it } from "vitest";
import catalog from "../data/exercises.json" with { type: "json" };
import versionFile from "../data/catalog-version.json" with { type: "json" };
import german from "../data/exercises.de.json" with { type: "json" };
import { translationVersion } from "../scripts/translation-version";

const de: Record<string, { name: string; instructions: string[] }> = german.exercises;

/** The German catalog is translated by hand (docs/adr/0007-german-language.md); these checks keep it complete. */
describe("German exercise catalog", () => {
  it("has an entry for every built-in exercise and nothing else", () => {
    const slugs = catalog.exercises.map((e) => e.slug);
    expect(slugs.filter((s) => !de[s])).toEqual([]);
    expect(Object.keys(de).filter((s) => !slugs.includes(s))).toEqual([]);
  });

  it("keeps the step count of the English instructions", () => {
    const off = catalog.exercises.filter((e) => de[e.slug]!.instructions.length !== e.instructions.length).map((e) => e.slug);
    expect(off).toEqual([]);
  });

  it("has short, non-empty names", () => {
    const names = Object.values(de).map((t) => t.name);
    expect(names.filter((n) => !n.trim() || n.length > 60)).toEqual([]);
    expect(Object.values(de).flatMap((t) => t.instructions).filter((s) => !s.trim())).toEqual([]);
  });

  // Lists show the equipment next to the name, so a name may repeat across equipment (as in English: "Bench Press"
  // for dumbbell and machine). Two exercises only share a German name and equipment if they share the English name.
  it("keeps exercises apart that English keeps apart", () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const e of catalog.exercises) {
      const key = `${de[e.slug]!.name}|${e.equipment}`;
      const other = seen.get(key);
      if (other !== undefined && other !== e.name) clashes.push(`${key}: ${other} / ${e.name}`);
      seen.set(key, e.name);
    }
    expect(clashes).toEqual([]);
  });

  it("is registered in catalog-version.json, so devices re-seed after a change (npm run catalog:version)", () => {
    expect(versionFile.translations.de).toBe(translationVersion(german));
  });

  it("uses metric units only", () => {
    const imperial = /\b(inch|inches|feet|foot|ft|lbs?|pounds?|mph|yards?|miles?)\b/i;
    const hits = Object.entries(de).filter(([, t]) => t.instructions.some((s) => imperial.test(s))).map(([s]) => s);
    expect(hits).toEqual([]);
  });
});
