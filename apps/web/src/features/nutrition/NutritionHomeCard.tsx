import { proteinStatus } from "@fitness/shared";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useBodyWeights, useFoodEntries, useSettings } from "@/data/hooks";
import { useT } from "@/i18n";
import { entriesOfDay, targetsFor, totalsOf, weightInfo } from "@/lib/nutrition";
import { useFormat } from "@/lib/useFormat";
import { IconChevron } from "@/ui/icons";
import { ProteinRing } from "./ProteinRing";

/** Home card "Nutrition today": small protein ring + kcal, taps through to the Nutrition tab. Hidden until targets exist. */
export function NutritionHomeCard({ now }: { now: Date }) {
  const t = useT();
  const n = t.nutrition;
  const fmt = useFormat();
  const s = useSettings();
  const entries = useFoodEntries();
  const weights = useBodyWeights();
  const w = useMemo(() => weightInfo(weights ?? []), [weights]);
  const day = now.toDateString();
  // Recomputed per day (and data change), not per clock tick.
  const tot = useMemo(() => totalsOf(entriesOfDay(entries ?? [], new Date(day))), [entries, day]);
  const targets = targetsFor(s, w, now);
  if (!entries || !targets) return null;
  const st = proteinStatus(tot.protein, targets.protein);
  const int = (x: number) => fmt.num(Math.round(x), 0);
  return (
    <Link to="/nutrition" className="card nutri-home" aria-label={`${n.homeCard}: ${n.ringAria(int(tot.protein), int(targets.protein), n.status[st])}, ${int(tot.kcal)} ${n.kcal}`}>
      <ProteinRing protein={tot.protein} target={targets.protein} status={st} size={64} />
      <span className="li-main" aria-hidden="true">
        <span className="lbl">{n.homeCard}</span>
        <span className="li-name">{int(tot.protein)} / {int(targets.protein)} g {n.protein}</span>
        <span className="li-meta">{int(tot.kcal)}{targets.kcal ? ` / ${int(targets.kcal)}` : ""} {n.kcal}</span>
      </span>
      <IconChevron className="chev" aria-hidden="true" />
    </Link>
  );
}
