import { useT } from "@/i18n";
import type { WeekDay } from "@/lib/home";
import { useFormat } from "@/lib/useFormat";
import { IconRun } from "@/ui/icons";

/**
 * "This week" card on Home (docs/design/screens/home.md → This week): goal line + segments (tap → goal sheet),
 * then a Mon–Sun strip. A day with a gym workout is a filled accent circle, a run adds a small runner below,
 * today has an accent ring. Streak line from 2 weeks in a row.
 */
export function WeekCard({ days, done, goal, runs, streak, loading, onEditGoal }: {
  days: WeekDay[]; done: number; goal: number; runs: number; streak: number; loading: boolean; onEditGoal: () => void;
}) {
  const t = useT();
  const fmt = useFormat();
  const reached = done >= goal;
  return (
    <section className={"card week" + (loading ? " loading" : "")} aria-busy={loading || undefined}>
      <button type="button" className="goal" onClick={onEditGoal} aria-label={t.home.goalAria(done, goal, runs)}>
        <span className="week-top">
          <span className="lbl">{t.home.thisWeek}</span>
          <span className={reached ? "week-state reached" : "week-state"}>{reached ? t.home.goalReached : t.home.toGo(goal - done)}</span>
        </span>
        <span className="goal-t">
          <b>{done}</b> {t.home.goalOf} <b>{goal}</b> {t.home.goalWorkouts}
          {runs > 0 && <> · <b>{runs}</b> {t.home.runsWord(runs)}</>}
        </span>
        <span className="segs" style={{ gridTemplateColumns: `repeat(${goal}, 1fr)` }} aria-hidden="true">
          {Array.from({ length: goal }, (_, i) => <i key={i} className={i < done ? "on" : ""} />)}
        </span>
      </button>
      <ol className="days" aria-label={t.home.thisWeek}>
        {days.map((d) => {
          const name = fmt.weekday(d.date);
          return (
            <li key={d.date.getTime()} className={"day" + (d.today ? " today" : "") + (d.future ? " future" : "") + (d.gym ? " gym" : "")}
              aria-current={d.today ? "date" : undefined}>
              <span className="sr-only">{t.home.dayAria(name, d.gym, d.runs, d.today)}</span>
              <span className="day-n" aria-hidden="true">{name.slice(0, 2)}</span>
              <span className="day-c" aria-hidden="true">{d.date.getDate()}</span>
              <span className="day-run" aria-hidden="true">{d.runs > 0 && <IconRun />}</span>
            </li>
          );
        })}
      </ol>
      {streak >= 2 && <p className="week-streak">{t.home.streak(streak)}</p>}
    </section>
  );
}
