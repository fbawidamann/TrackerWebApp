import type { FoodEntry } from "@fitness/shared";
import { useMemo, useState } from "react";
import { useBodyWeights, useFoodEntries, useSettings } from "@/data/hooks";
import { useT } from "@/i18n";
import { addDays, entriesOfDay, proteinDays, proteinStreak, sameDay, startOfDay, targetsFor, totalsOf, weightInfo } from "@/lib/nutrition";
import { useNow } from "@/lib/time";
import { useFormat } from "@/lib/useFormat";
import { proteinStatus } from "@fitness/shared";
import { IconBack, IconBarcode, IconChevron, IconPlus, IconSliders } from "@/ui/icons";
import { AddFood } from "./AddFood";
import { AmountSheet } from "./AmountSheet";
import { ProteinRing, ProteinWeek } from "./ProteinRing";
import { TargetsSheet } from "./TargetsSheet";
import { WeightCard } from "./WeightCard";

/** Nutrition tab (docs/design/screens/nutrition.md): protein ring first, kcal second, carbs/fat small, entries by time. */
export function NutritionScreen() {
  const t = useT();
  const n = t.nutrition;
  const fmt = useFormat();
  const settings = useSettings();
  const entries = useFoodEntries();
  const weights = useBodyWeights();
  const nowMs = useNow(60_000);
  const now = new Date(nowMs);
  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [add, setAdd] = useState<null | "search" | "scan">(null);
  const [edit, setEdit] = useState<FoodEntry | null>(null);
  const [targetsOpen, setTargetsOpen] = useState(false);

  const w = useMemo(() => weightInfo(weights ?? []), [weights]);
  const targets = targetsFor(settings, w, now);
  const list = useMemo(() => entriesOfDay(entries ?? [], day), [entries, day]);
  const tot = totalsOf(list);
  const pTarget = targets?.protein ?? 0;
  const status = proteinStatus(tot.protein, pTarget);
  const week = useMemo(() => proteinDays(entries ?? [], startOfDay(new Date(nowMs)), pTarget, new Date(nowMs)), [entries, nowMs, pTarget]);
  const streak = useMemo(() => proteinStreak(entries ?? [], pTarget, new Date(nowMs)), [entries, pTarget, nowMs]);
  const isToday = sameDay(day, now);
  const dayLabel = isToday ? n.today : sameDay(day, addDays(now, -1)) ? n.yesterday : `${fmt.weekday(day)}, ${fmt.shortDate(day)}`;
  const int = (x: number) => fmt.num(Math.round(x), 0);

  const kcalTarget = targets?.kcal ?? 0;
  const kcalLeft = kcalTarget - tot.kcal;
  const bar = (label: string, v: number, target: number, cls: string) => (
    <div className={"mbar " + cls}>
      <div className="mbar-top"><span>{label}</span><span><b>{int(v)}</b>{target ? <span className="muted"> / {int(target)} g</span> : " g"}</span></div>
      {target > 0 && <div className="mbar-track"><i style={{ width: `${Math.min(100, (v / target) * 100)}%` }} /></div>}
    </div>
  );

  return (
    <div className="page nutri">
      <div className="nutri-head">
        <button type="button" className="ib" aria-label={n.prevDay} onClick={() => setDay((d) => addDays(d, -1))}><IconBack /></button>
        <h1 className="title">{dayLabel}</h1>
        <button type="button" className="ib" aria-label={n.nextDay} disabled={isToday} onClick={() => setDay((d) => addDays(d, 1))}><IconChevron /></button>
        <button type="button" className="ib" aria-label={n.targets} onClick={() => setTargetsOpen(true)}><IconSliders /></button>
      </div>

      {targets === null ? (
        <button type="button" className="card nutri-setup" onClick={() => setTargetsOpen(true)}>
          <b>{n.setTargets}</b>
          <span className="muted">{n.setTargetsHint}</span>
        </button>
      ) : (
        <div className="card nutri-hero">
          <ProteinRing protein={tot.protein} target={pTarget} status={status} />
          <div className="nutri-side">
            <div className="kcal">
              <span className="lbl">{n.kcal}</span>
              <b>{int(tot.kcal)}</b>
              {kcalTarget > 0 && <span className="muted"> / {int(kcalTarget)}</span>}
              {kcalTarget > 0 && (
                <>
                  <div className="mbar-track kcal-track"><i style={{ width: `${Math.min(100, (tot.kcal / kcalTarget) * 100)}%` }} /></div>
                  {/* Over the target is not red: a surplus is the goal (docs/design/screens/nutrition.md). */}
                  <span className="kcal-left">{kcalLeft >= 0 ? n.left(int(kcalLeft)) : n.over(int(-kcalLeft))}</span>
                </>
              )}
            </div>
            <p className="prot-left">{tot.protein >= pTarget ? n.proteinDone : n.proteinLeft(int(pTarget - tot.protein))}</p>
          </div>
          <div className="nutri-minor">
            {bar(n.carbs, tot.carbs, targets.carbs, "carb")}
            {bar(n.fat, tot.fat, targets.fat, "fat")}
          </div>
          <ProteinWeek days={week} selected={day} onSelect={(d) => setDay(startOfDay(d))} />
          {streak >= 2 && <p className="nutri-streak">{n.streak(streak)}</p>}
        </div>
      )}

      <div className="nutri-actions">
        <button type="button" className="btn btn-primary" onClick={() => setAdd("search")}><IconPlus />{n.add}</button>
        <button type="button" className="btn" onClick={() => setAdd("scan")}><IconBarcode />{n.scan}</button>
      </div>

      <div className="sec">
        <span className="lbl">{n.entries}</span>
        {entries === undefined ? <div className="card skel" aria-hidden="true"><i /><i /></div>
          : list.length === 0 ? (
            <div className="card empty"><p className="empty-t">{n.noEntries}</p><p>{n.noEntriesHint}</p></div>
          ) : (
            <div className="card list">
              {list.map((e) => (
                <button key={e.id} type="button" className="li entry-li" onClick={() => setEdit(e)}>
                  <span className="entry-time">{fmt.time(new Date(e.eatenAt))}</span>
                  <span className="li-main">
                    <span className="li-name">{e.name}</span>
                    <span className="li-meta">{n.entryMeta(`${fmt.num(e.amount, 1)} ${e.unit}`, int(e.kcal), fmt.num(e.protein, 1))}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
      </div>

      <WeightCard info={w} />

      {add && <AddFood day={day} startWithScan={add === "scan"} onClose={() => setAdd(null)} />}
      {edit && <AmountSheet entry={edit} day={day} onClose={() => setEdit(null)} onDone={() => setEdit(null)} />}
      {targetsOpen && <TargetsSheet info={w} onClose={() => setTargetsOpen(false)} />}
    </div>
  );
}
