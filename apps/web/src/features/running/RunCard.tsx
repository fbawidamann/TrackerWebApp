import { useT } from "@/i18n";
import type { RunView } from "@/lib/runStats";
import type { Fmt } from "@/lib/useFormat";
import { IconMedal, IconRun } from "@/ui/icons";

/** A run in the History timeline and calendar (docs/design/screens/running.md → History). Same card as a workout. */
export function RunCard({ r, fmt, pb, onOpen }: { r: RunView; fmt: Fmt; pb: boolean; onOpen: () => void }) {
  const t = useT();
  return (
    <button type="button" className="card wcard" onClick={onOpen}>
      <span className="wc-head">
        <span className="wc-name">
          <span className="wc-run"><IconRun aria-hidden="true" /><span>{r.activity.name}</span></span>
          {pb && <span className="medal" aria-label={t.running.personalBest}><IconMedal /></span>}
        </span>
        <span className="wc-date">{fmt.date(r.start)} · {fmt.runTime(r.run.movingTimeS)}</span>
      </span>
      <span className="run-figs">
        <span className="nw">{fmt.dist(r.run.distanceM)}<span className="u">km</span></span>
        <span className="nw">{fmt.pace(r.pace)}<span className="u">/km</span></span>
        {r.run.elevationGainM !== null && r.run.elevationGainM > 0 && <span className="nw">{fmt.num(r.run.elevationGainM, 0)}<span className="u">m</span></span>}
      </span>
    </button>
  );
}
