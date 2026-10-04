import type { HeatWeek } from "@/lib/stats";

/**
 * Consistency grid (docs/design/screens/stats.md): one column per week (oldest left), one cell per day (week start
 * on top), filled when you trained. A bar under a column = weekly goal reached. Each column is a button: tapping it
 * selects the week, the parent shows the readout.
 */
export function ConsistencyGrid({ weeks, goal, selected, onSelect, dayLabels, weekLabel, ariaFor, label }: {
  weeks: HeatWeek[]; goal: number; selected: number; onSelect: (i: number) => void;
  /** Short names for the 7 rows (first = week start). Only every second one is shown. */
  dayLabels: string[];
  /** Axis label under a column (shown for every 4th week, counted from the newest). */
  weekLabel: (start: Date) => string;
  ariaFor: (w: HeatWeek, reached: boolean) => string;
  label: string;
}) {
  return (
    <div className="cgrid12" role="group" aria-label={label}>
      <div className="cg-days" aria-hidden="true">
        {dayLabels.map((d, i) => <span key={i}>{i % 2 === 0 ? d : ""}</span>)}
      </div>
      {weeks.map((w, i) => {
        const reached = goal > 0 && w.count >= goal;
        return (
          <button key={w.start.getTime()} type="button" className={"cg-col" + (i === selected ? " on" : "")}
            aria-pressed={i === selected} aria-label={ariaFor(w, reached)} onClick={() => onSelect(i)}>
            {w.days.map((d) => (
              <i key={d.date.getTime()} className={"cg-d" + (d.future ? " fut" : d.count >= 2 ? " l2" : d.count === 1 ? " l1" : "")} />
            ))}
            <b className={"cg-goal" + (reached ? " ok" : "")} />
          </button>
        );
      })}
      <span />
      {weeks.map((w, i) => (
        <span key={w.start.getTime()} className="cg-x" aria-hidden="true">{(weeks.length - 1 - i) % 4 === 0 ? weekLabel(w.start) : ""}</span>
      ))}
    </div>
  );
}
