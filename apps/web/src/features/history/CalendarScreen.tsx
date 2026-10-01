import { startOfDay } from "@fitness/shared";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useCatalog, useRuns, useSettings, useTraining } from "@/data/hooks";
import { RunCard } from "@/features/running/RunCard";
import { personalBests, type RunView } from "@/lib/runStats";
import { useT } from "@/i18n";
import type { WorkoutView } from "@/lib/training";
import { useFormat } from "@/lib/useFormat";
import { IconBack, IconChevron } from "@/ui/icons";
import { WorkoutCard } from "./WorkoutCard";

type Item = { kind: "gym"; w: WorkoutView; start: Date } | { kind: "run"; r: RunView; start: Date };

/** Remembered while the app is open, so Back from a workout returns to the same month and day. */
const memory: { month: Date | null; day: number | null | undefined } = { month: null, day: undefined };

/** Month calendar with a dot on training days (workouts and runs); tap a day to see them (docs/design/screens/history.md → Calendar). */
export function CalendarScreen() {
  const router = useRouter();
  const navigate = useNavigate();
  const training = useTraining();
  const runs = useRuns();
  const catalog = useCatalog();
  const settings = useSettings();
  const fmt = useFormat();
  const t = useT();
  const h = t.history;
  const today = startOfDay(new Date());
  const [month, setMonthState] = useState(() => memory.month ?? new Date(today.getFullYear(), today.getMonth(), 1));
  const [day, setDayState] = useState<number | null | undefined>(memory.day);
  const setMonth = (m: Date) => { memory.month = m; setMonthState(m); };
  const setDay = (d: number | null | undefined) => { memory.day = d; setDayState(d); };

  const byDay = useMemo(() => {
    const m = new Map<number, Item[]>();
    const items: Item[] = [
      ...training.workouts.map((w): Item => ({ kind: "gym", w, start: w.start })),
      ...(runs ?? []).map((r): Item => ({ kind: "run", r, start: r.start })),
    ];
    for (const it of items) {
      if (it.start.getFullYear() !== month.getFullYear() || it.start.getMonth() !== month.getMonth()) continue;
      const d = it.start.getDate();
      m.set(d, [...(m.get(d) ?? []), it]);
    }
    return m;
  }, [training.workouts, runs, month]);
  const runPbs = useMemo(() => new Set(personalBests(runs ?? []).map((b) => b.activityId)), [runs]);
  const lastTrained = byDay.size ? Math.max(...byDay.keys()) : null;
  const selected = day === undefined ? lastTrained : day;
  const all = [...byDay.values()].flat();
  const gymCount = all.filter((i) => i.kind === "gym").length, runCount = all.length - gymCount;
  const countText = h.weekCount;

  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const lead = settings.weekStart === "monday" ? (month.getDay() + 6) % 7 : month.getDay();
  const labels = settings.weekStart === "monday" ? h.weekdaysMon : h.weekdaysSun;
  const isFutureMonth = month.getFullYear() > today.getFullYear() || (month.getFullYear() === today.getFullYear() && month.getMonth() >= today.getMonth());
  const shift = (dir: number) => { setMonth(new Date(month.getFullYear(), month.getMonth() + dir, 1)); setDay(undefined); };

  const selDate = selected ? new Date(month.getFullYear(), month.getMonth(), selected) : null;
  const dayWorkouts = selected ? [...(byDay.get(selected) ?? [])].sort((a, b) => a.start.getTime() - b.start.getTime()) : [];

  return (
    <div className="page tight">
      <div className="topbar">
        <button type="button" className="ib" onClick={() => router.history.back()} aria-label={h.backToHistory}><IconBack /></button>
        <span className="t">{h.calendar}</span>
        <span style={{ width: 40 }} />
      </div>
      <div className="card cal">
        <div className="cal-head">
          <button type="button" className="ib" onClick={() => shift(-1)} aria-label={h.prevMonth}><IconBack /></button>
          <span className="cal-title">
            <b>{fmt.month(month.getMonth())}{month.getFullYear() !== today.getFullYear() ? " " + month.getFullYear() : ""}</b>
            <span className="li-meta">{countText(gymCount, runCount)}</span>
          </span>
          <button type="button" className="ib" onClick={() => shift(1)} disabled={isFutureMonth} aria-label={h.nextMonth}><IconChevron /></button>
        </div>
        <div className="cgrid">
          {labels.map((l, i) => <span key={i} className="cwd">{l}</span>)}
          {Array.from({ length: lead }, (_, i) => <span key={"e" + i} />)}
          {Array.from({ length: days }, (_, i) => {
            const d = i + 1;
            const date = new Date(month.getFullYear(), month.getMonth(), d);
            const list = byDay.get(d) ?? [];
            const n = list.length;
            const cls = "cday" + (n ? " has" : "") + (selected === d ? " sel" : "") + (date.getTime() === today.getTime() ? " today" : "");
            return (
              <button key={d} type="button" className={cls} disabled={date > today} onClick={() => setDay(d)} aria-pressed={selected === d}
                aria-label={`${fmt.dayMonth(date)}${n ? `, ${countText(list.filter((i) => i.kind === "gym").length, list.filter((i) => i.kind === "run").length)}` : ""}`}>
                <span className="cnum">{d}</span><span className="cdot" />
              </button>
            );
          })}
        </div>
      </div>
      {selDate && (
        <div className="week">
          <span className="lbl">{fmt.date(selDate)}</span>
          {dayWorkouts.length ? dayWorkouts.map((it) => it.kind === "gym" ? (
            <WorkoutCard key={it.w.activity.id} w={it.w} catalog={catalog} fmt={fmt} style={settings.historyCardStyle} query=""
              onOpen={() => void navigate({ to: "/history/$activityId", params: { activityId: it.w.activity.id } })} />
          ) : (
            <RunCard key={it.r.activity.id} r={it.r} fmt={fmt} pb={runPbs.has(it.r.activity.id)}
              onOpen={() => void navigate({ to: "/running/$activityId", params: { activityId: it.r.activity.id } })} />
          )) : <div className="card empty"><p>{h.nothingOnDay}</p></div>}
        </div>
      )}
    </div>
  );
}
