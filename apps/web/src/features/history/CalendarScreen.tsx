import { MONTHS, startOfDay } from "@fitness/shared";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useCatalog, useSettings, useTraining } from "@/data/hooks";
import type { WorkoutView } from "@/lib/training";
import { useFormat } from "@/lib/useFormat";
import { IconBack, IconChevron } from "@/ui/icons";
import { WorkoutCard } from "./WorkoutCard";

/** Remembered while the app is open, so Back from a workout returns to the same month and day. */
const memory: { month: Date | null; day: number | null | undefined } = { month: null, day: undefined };

/** Month calendar with a dot on training days; tap a day to see its workouts (docs/design/screens/history.md → Calendar). */
export function CalendarScreen() {
  const router = useRouter();
  const navigate = useNavigate();
  const training = useTraining();
  const catalog = useCatalog();
  const settings = useSettings();
  const fmt = useFormat();
  const today = startOfDay(new Date());
  const [month, setMonthState] = useState(() => memory.month ?? new Date(today.getFullYear(), today.getMonth(), 1));
  const [day, setDayState] = useState<number | null | undefined>(memory.day);
  const setMonth = (m: Date) => { memory.month = m; setMonthState(m); };
  const setDay = (d: number | null | undefined) => { memory.day = d; setDayState(d); };

  const byDay = useMemo(() => {
    const m = new Map<number, WorkoutView[]>();
    for (const w of training.workouts) {
      if (w.start.getFullYear() !== month.getFullYear() || w.start.getMonth() !== month.getMonth()) continue;
      const d = w.start.getDate();
      m.set(d, [...(m.get(d) ?? []), w]);
    }
    return m;
  }, [training.workouts, month]);
  const lastTrained = byDay.size ? Math.max(...byDay.keys()) : null;
  const selected = day === undefined ? lastTrained : day;
  const count = [...byDay.values()].reduce((n, l) => n + l.length, 0);

  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const lead = settings.weekStart === "monday" ? (month.getDay() + 6) % 7 : month.getDay();
  const labels = settings.weekStart === "monday" ? ["M", "T", "W", "T", "F", "S", "S"] : ["S", "M", "T", "W", "T", "F", "S"];
  const isFutureMonth = month.getFullYear() > today.getFullYear() || (month.getFullYear() === today.getFullYear() && month.getMonth() >= today.getMonth());
  const shift = (dir: number) => { setMonth(new Date(month.getFullYear(), month.getMonth() + dir, 1)); setDay(undefined); };

  const selDate = selected ? new Date(month.getFullYear(), month.getMonth(), selected) : null;
  const dayWorkouts = selected ? [...(byDay.get(selected) ?? [])].sort((a, b) => a.start.getTime() - b.start.getTime()) : [];

  return (
    <div className="page tight">
      <div className="topbar">
        <button type="button" className="ib" onClick={() => router.history.back()} aria-label="Back to history"><IconBack /></button>
        <span className="t">Calendar</span>
        <span style={{ width: 40 }} />
      </div>
      <div className="card cal">
        <div className="cal-head">
          <button type="button" className="ib" onClick={() => shift(-1)} aria-label="Previous month"><IconBack /></button>
          <span className="cal-title">
            <b>{MONTHS[month.getMonth()]}{month.getFullYear() !== today.getFullYear() ? " " + month.getFullYear() : ""}</b>
            <span className="li-meta">{count} {count === 1 ? "workout" : "workouts"}</span>
          </span>
          <button type="button" className="ib" onClick={() => shift(1)} disabled={isFutureMonth} aria-label="Next month"><IconChevron /></button>
        </div>
        <div className="cgrid">
          {labels.map((l, i) => <span key={i} className="cwd">{l}</span>)}
          {Array.from({ length: lead }, (_, i) => <span key={"e" + i} />)}
          {Array.from({ length: days }, (_, i) => {
            const d = i + 1;
            const date = new Date(month.getFullYear(), month.getMonth(), d);
            const n = byDay.get(d)?.length ?? 0;
            const cls = "cday" + (n ? " has" : "") + (selected === d ? " sel" : "") + (date.getTime() === today.getTime() ? " today" : "");
            return (
              <button key={d} type="button" className={cls} disabled={date > today} onClick={() => setDay(d)} aria-pressed={selected === d}
                aria-label={`${d} ${MONTHS[month.getMonth()]}${n ? `, ${n} ${n === 1 ? "workout" : "workouts"}` : ""}`}>
                <span className="cnum">{d}</span><span className="cdot" />
              </button>
            );
          })}
        </div>
      </div>
      {selDate && (
        <div className="week">
          <span className="lbl">{fmt.date(selDate)}</span>
          {dayWorkouts.length ? dayWorkouts.map((w) => (
            <WorkoutCard key={w.activity.id} w={w} catalog={catalog} fmt={fmt} style={settings.historyCardStyle} query=""
              onOpen={() => void navigate({ to: "/history/$activityId", params: { activityId: w.activity.id } })} />
          )) : <div className="card empty"><p>No workout on this day</p></div>}
        </div>
      )}
    </div>
  );
}
