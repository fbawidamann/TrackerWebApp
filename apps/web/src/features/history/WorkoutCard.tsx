import { Fragment } from "react";
import type { Catalog } from "@/data/hooks";
import { useT } from "@/i18n";
import { columnsFor, matchesQuery } from "@/lib/labels";
import type { WorkoutView } from "@/lib/training";
import type { Fmt } from "@/lib/useFormat";
import { IconMedal } from "@/ui/icons";

/**
 * History card. "names": exercise names as one calm muted line (max 2 lines), numbers only for PRs.
 * "detailed": one line per exercise with "4 sets · best 82.5 kg" (setting in Profile).
 */
export function WorkoutCard({ w, catalog, fmt, style, query, onOpen }: {
  w: WorkoutView; catalog: Catalog; fmt: Fmt; style: "names" | "detailed"; query: string; onOpen: () => void;
}) {
  const t = useT();
  const hit = (exerciseId: string) => !!query.trim() && matchesQuery(catalog.byId.get(exerciseId)?.name ?? "", query);
  const name = (id: string) => catalog.byId.get(id)?.name ?? t.common.exercise;
  return (
    <button type="button" className="card wcard" onClick={onOpen}>
      <span className="wc-head">
        <span className="wc-name"><span>{w.activity.name}</span>{w.prCount > 0 && <span className="medal" aria-label={t.common.pr}><IconMedal /></span>}</span>
        <span className="wc-date">{fmt.date(w.start)} · {fmt.duration(w.durationMin)}</span>
      </span>
      {style === "names" ? (
        <>
          <span className="names">
            {w.exercises.map((e, i) => (
              <Fragment key={e.ae.id}>
                {i > 0 && <span className="dotsep"> · </span>}
                <span className={hit(e.ae.exerciseId) ? "hit" : undefined}>{name(e.ae.exerciseId)}</span>
              </Fragment>
            ))}
          </span>
          {w.prCount > 0 && (
            <span className="prlines">
              {w.exercises.filter((e) => e.pr).map((e) => (
                <span className="prline" key={e.ae.id}>
                  <span className="n"><span className="medal sm"><IconMedal /></span>{name(e.ae.exerciseId)}</span>
                  <span className="v nw">{fmt.weightValue(e.pr!.value)}<span className="u">{fmt.unit}</span></span>
                </span>
              ))}
            </span>
          )}
        </>
      ) : (
        <span className="exlines">
          {w.exercises.slice(0, 5).map((e) => {
            const cols = columnsFor(catalog.byId.get(e.ae.exerciseId));
            const work = e.sets.filter((s) => s.setType !== "warmup");
            const best = cols.weight
              ? t.history.bestWeight(fmt.weight(Math.max(0, ...work.map((s) => s.weightKg ?? 0))))
              : cols.reps ? t.history.bestReps(Math.max(0, ...work.map((s) => s.reps ?? 0))) : "";
            return (
              <span key={e.ae.id} className={"exline" + (hit(e.ae.exerciseId) ? " hit" : "")}>
                <span className="n">{name(e.ae.exerciseId)}{e.pr && <span className="medal sm" aria-label={t.common.pr}><IconMedal /></span>}</span>
                <span className="m">{t.history.setsBest(e.sets.length, best)}</span>
              </span>
            );
          })}
          {w.exercises.length > 5 && <span className="more">{t.history.moreExercises(w.exercises.length - 5)}</span>}
        </span>
      )}
    </button>
  );
}
