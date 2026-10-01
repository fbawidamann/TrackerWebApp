import type { Exercise, WorkoutSet } from "@fitness/shared";
import { formatClock } from "@fitness/shared";
import { useT } from "@/i18n";
import { columnsFor } from "@/lib/labels";
import type { Fmt } from "@/lib/useFormat";
import { IconMedal } from "@/ui/icons";

/** Value of one set as text parts, e.g. 80 kg × 8, 12 reps, 1:30. */
export function SetValue({ set, exercise, fmt }: { set: WorkoutSet; exercise: Exercise | undefined; fmt: Fmt }) {
  const cols = columnsFor(exercise);
  const w = useT().workout;
  if (cols.time) {
    return (
      <span className="nw">
        {cols.weight && set.weightKg !== null && <>{fmt.weightValue(set.weightKg)}<span className="u">{fmt.unit}</span><span className="x">×</span></>}
        {formatClock(set.durationS ?? 0)}
      </span>
    );
  }
  if (!cols.weight) return <span className="nw">{set.reps ?? 0}<span className="u">{w.repsUnit}</span></span>;
  return (
    <span className="nw">
      {fmt.weightValue(set.weightKg ?? 0)}<span className="u">{fmt.unit}</span><span className="x">×</span>{set.reps ?? 0}
    </span>
  );
}

/** Read-only set rows with light "W" for warm-ups and a medal on the PR set. */
export function SetList({ sets, exercise, fmt, prValue }: { sets: WorkoutSet[]; exercise: Exercise | undefined; fmt: Fmt; prValue?: number | null }) {
  const t = useT();
  let n = 0;
  let marked = false;
  return (
    <div className="sets">
      {sets.map((s) => {
        const warm = s.setType === "warmup";
        if (!warm) n++;
        const isPr = !marked && !warm && prValue != null && s.weightKg === prValue;
        if (isPr) marked = true;
        return (
          <div className="set" key={s.id}>
            <span className={"set-n" + (warm ? " w" : "")}>{warm ? t.workout.warmupShort : n}</span>
            <span className="set-v"><SetValue set={s} exercise={exercise} fmt={fmt} /></span>
            {isPr ? <span className="medal" aria-label={t.common.pr}><IconMedal /></span> : <span />}
          </div>
        );
      })}
    </div>
  );
}
