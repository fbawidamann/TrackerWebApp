import { toDisplayWeight, type Exercise } from "@fitness/shared";
import { useNavigate, useParams, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { deleteCustomExercise, exerciseUsageCount, setExerciseHidden } from "@/db/actions";
import { muscleGroup, useCatalog, useTraining } from "@/data/hooks";
import { useT } from "@/i18n";
import type { ExerciseSession, PrEvent } from "@/lib/training";
import { useFormat, type Fmt } from "@/lib/useFormat";
import { SetList } from "@/features/common/SetList";
import { IconBack, IconImage, IconMedal, IconMore } from "@/ui/icons";
import { LineChart, type ChartPoint } from "@/ui/LineChart";
import { ConfirmSheet, MenuSheet } from "@/ui/Sheet";
import { useToast } from "@/ui/Toast";
import { ExerciseForm } from "./ExerciseForm";

type Tab = "progress" | "history" | "about";
type Range = "3M" | "6M" | "1Y" | "All";

interface TabProps {
  exercise: Exercise;
  sessions: ExerciseSession[];
  prEvents: PrEvent[];
  fmt: Fmt;
  onOpen: (activityId: string) => void;
}

export function ExerciseDetailScreen() {
  const { exerciseId } = useParams({ from: "/exercises/$exerciseId" });
  const router = useRouter();
  const navigate = useNavigate();
  const toast = useToast();
  const catalog = useCatalog();
  const training = useTraining();
  const fmt = useFormat();
  const t = useT();
  const x = t.exercises;
  const e = catalog.byId.get(exerciseId);
  const sessions = useMemo(() => training.sessionsByExercise.get(exerciseId) ?? [], [training, exerciseId]);
  const [tab, setTab] = useState<Tab | null>(null);
  const [menu, setMenu] = useState(false);
  const [edit, setEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  if (!catalog.loaded || !training.loaded) return <div className="page" />;
  if (!e) return <div className="page"><p className="muted">{x.notFound}</p></div>;
  const activeTab: Tab = tab ?? (sessions.length ? "progress" : "about");
  const hidden = catalog.hidden.has(e.id);
  const openWorkout = (id: string) => void navigate({ to: "/history/$activityId", params: { activityId: id } });

  const toggleHidden = async () => {
    await setExerciseHidden(e.id, !hidden);
    toast(hidden ? x.visibleAgain : x.hiddenToast);
  };

  return (
    <div className="page tight">
      <div className="topbar">
        <button type="button" className="ib" onClick={() => router.history.back()} aria-label={t.common.back}><IconBack /></button>
        <button type="button" className="ib" onClick={() => setMenu(true)} aria-label={x.options}><IconMore /></button>
      </div>
      <div>
        <h1 className="title">{e.name}</h1>
        <p className="sub">{t.equipment[e.equipment]} · {t.group[muscleGroup(e)]}{hidden ? " · " + x.hidden : ""}</p>
      </div>
      <div className="seg" role="tablist" aria-label={x.sections}>
        {(["progress", "history", "about"] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={activeTab === k} onClick={() => setTab(k)}>{x.tabs[k]}</button>
        ))}
      </div>
      {activeTab === "progress" && <ProgressTab exercise={e} sessions={sessions} prEvents={training.prEvents} fmt={fmt} onOpen={openWorkout} />}
      {activeTab === "history" && <HistoryTab exercise={e} sessions={sessions} prEvents={training.prEvents} fmt={fmt} onOpen={openWorkout} />}
      {activeTab === "about" && <AboutTab exercise={e} />}

      {menu && (
        <MenuSheet title={e.name} onClose={() => setMenu(false)} items={[
          ...(e.isCustom ? [{ label: t.common.edit, onSelect: () => setEdit(true) }] : []),
          { label: hidden ? x.unhide : x.hide, onSelect: () => void toggleHidden() },
          ...(e.isCustom ? [{ label: t.common.delete, danger: true, onSelect: () => void exerciseUsageCount(e.id).then(setConfirmDelete) }] : []),
        ]} />
      )}
      {confirmDelete !== null && (
        <ConfirmSheet title={x.deleteTitle(e.name)} danger confirm={t.common.delete}
          text={confirmDelete ? x.deleteUsed(confirmDelete) : x.deleteUnused}
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => void deleteCustomExercise(e.id).then(() => { toast(x.deleted); void navigate({ to: "/exercises" }); })} />
      )}
      {edit && <ExerciseForm edit={e} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); toast(x.saved); }} />}
    </div>
  );

}

/* ---------- Tabs (module level so their state survives data updates) ---------- */

function ProgressTab({ exercise, sessions: all, prEvents, fmt, onOpen }: TabProps) {
  const repsOnly = exercise.trackingType === "reps_only";
  const timed = exercise.trackingType === "duration" || exercise.trackingType === "distance_duration";
  const [metric, setMetric] = useState<"w" | "r">(repsOnly ? "r" : "w");
  const [range, setRange] = useState<Range>("3M");
  const [sel, setSel] = useState<number | null>(null);
  const x = useT().exercises;
  const prs = prEvents.filter((p) => p.exerciseId === exercise.id);
  if (!all.length) return <div className="card empty"><p>{x.noSessions}</p></div>;
  if (timed) return <div className="card empty"><p>{x.timedNoChart(all.length)}</p></div>;

  const m = repsOnly ? "r" : metric;
  const now = new Date();
  const months = { "3M": 3, "6M": 6, "1Y": 12, All: 0 }[range];
  const from = months ? new Date(now.getFullYear(), now.getMonth() - months, now.getDate()) : all[0]!.date;
  const points: ChartPoint[] = all
    .filter((s) => s.date >= from)
    .map((s) => ({ date: s.date, value: m === "w" ? toDisplayWeight(s.heaviest ?? 0, fmt.prefs) : s.bestReps ?? 0 }))
    .filter((p) => p.value > 0);
  const selected = sel !== null && sel < points.length ? sel : points.length - 1;
  const sp = points[selected];
  const heaviest = all.reduce<{ v: number; d: Date } | null>((b, s) => (s.heaviest !== null && (!b || s.heaviest > b.v) ? { v: s.heaviest, d: s.date } : b), null);
  const bestReps = all.reduce((b, s) => Math.max(b, s.bestReps ?? 0), 0);

  return (
    <>
      <div className="chart-top">
        {repsOnly ? <span className="lbl">{x.bestSetReps}</span> : (
          <div className="seg inline" role="group" aria-label={x.chartMetric}>
            <button type="button" aria-pressed={m === "w"} onClick={() => { setMetric("w"); setSel(null); }}>{x.weight}</button>
            <button type="button" aria-pressed={m === "r"} onClick={() => { setMetric("r"); setSel(null); }}>{x.reps}</button>
          </div>
        )}
        <div className="mini-seg" role="group" aria-label={x.timeRange}>
          {(["3M", "6M", "1Y", "All"] as const).map((r) => <button key={r} type="button" aria-pressed={range === r} onClick={() => { setRange(r); setSel(null); }}>{x.ranges[r]}</button>)}
        </div>
      </div>
      <div className="readout" aria-live="polite">
        {sp && <><b>{m === "w" ? <span className="nw">{fmt.num(sp.value, 1)}<span className="u">{fmt.unit}</span></span> : <span className="nw">{sp.value}<span className="u">{x.repsUnit}</span></span>}</b>{fmt.date(sp.date)}</>}
      </div>
      <div className="card chart">
        <LineChart points={points} from={from} to={now} selected={selected} onSelect={setSel}
          steps={m === "w" ? [1, 2.5, 5, 10, 20, 25, 50, 100] : [1, 2, 5, 10, 20]}
          format={(v) => fmt.num(v, 1)} label={m === "w" ? x.chartWeight : x.chartReps} />
      </div>
      <div className="card stats two">
        {repsOnly || !heaviest
          ? <div className="stat"><span className="stat-v">{all.length}</span><span className="lbl">{x.sessions}</span></div>
          : <div className="stat"><span className="stat-v">{fmt.weightValue(heaviest.v)}<span className="u">{fmt.unit}</span></span><span className="lbl">{x.heaviest(fmt.relDay(heaviest.d))}</span></div>}
        <div className="stat"><span className="stat-v">{bestReps}<span className="u">{x.repsUnit}</span></span><span className="lbl">{x.bestSet}</span></div>
      </div>
      {prs.length > 0 && (
        <div className="sec">
          <span className="lbl">{x.prHistory}</span>
          <div className="card list">
            {prs.slice(0, 10).map((p) => (
              <button key={p.activityId + p.value} type="button" className="li" onClick={() => onOpen(p.activityId)}>
                <span className="lead">
                  <span className="medal"><IconMedal /></span>
                  <span className="li-main">
                    <span className="li-name nw">{fmt.weightValue(p.value)}<span className="u">{fmt.unit}</span></span>
                    <span className="li-meta">{fmt.relDay(p.date)} · {p.workoutName}</span>
                  </span>
                </span>
                <span className="li-side">{x.was(fmt.weight(p.previous))}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function HistoryTab({ exercise, sessions: all, prEvents, fmt, onOpen }: TabProps) {
  const [limit, setLimit] = useState(20);
  const t = useT();
  if (!all.length) return <div className="card empty"><p>{t.exercises.noSessions}</p></div>;
  const prByAct = new Map(prEvents.filter((p) => p.exerciseId === exercise.id).map((p) => [p.activityId, p.value]));
  const list = [...all].reverse();
  return (
    <>
      {list.slice(0, limit).map((s) => (
        <button key={s.aeId} type="button" className="card ex" onClick={() => onOpen(s.activityId)} style={{ textAlign: "left", width: "100%" }}>
          <span className="ex-head" style={{ alignItems: "baseline" }}>
            <span style={{ fontWeight: 500 }}>{fmt.date(s.date)}</span>
            <span className="li-meta">{s.workoutName}</span>
          </span>
          <SetList sets={s.sets} exercise={exercise} fmt={fmt} prValue={prByAct.get(s.activityId) ?? null} />
        </button>
      ))}
      {list.length > limit && <button type="button" className="ghost" onClick={() => setLimit(limit + 20)} style={{ justifySelf: "center" }}>{t.common.showMore}</button>}
    </>
  );
}

function AboutTab({ exercise }: { exercise: Exercise }) {
  const [all, setAll] = useState(false);
  const t = useT();
  const x = t.exercises;
  const rows: Array<[string, string, boolean?]> = [
    [x.primaryMuscle, t.muscle[exercise.primaryMuscle]],
    ...(exercise.secondaryMuscles.length ? [[x.secondary, exercise.secondaryMuscles.map((m) => t.muscle[m]).join(", "), true] as [string, string, boolean]] : []),
    [x.equipment, t.equipment[exercise.equipment]],
    ...(exercise.level ? [[x.level, t.level[exercise.level]] as [string, string]] : []),
    [x.type, t.tracking[exercise.trackingType]],
  ];
  const steps = exercise.instructions;
  return (
    <>
      {!exercise.isCustom && exercise.images.length > 0 && (
        <div className="imgs">
          {exercise.images.slice(0, 2).map((src, i) => <ExerciseImage key={src} src={src} label={i === 0 ? x.startPosition : x.endPosition} />)}
        </div>
      )}
      <div className="card kv">
        {rows.map(([k, v, muted]) => (
          <div className="kv-row" key={k}><span className="k">{k}</span><span className="v" style={muted ? { color: "var(--muted)" } : undefined}>{v}</span></div>
        ))}
      </div>
      {steps.length > 0 && (
        <div className="sec">
          <span className="lbl">{x.instructions}</span>
          <ol className="steps-list">{(all ? steps : steps.slice(0, 3)).map((s, i) => <li key={i}>{s}</li>)}</ol>
          {steps.length > 3 && !all && <button type="button" className="ghost" onClick={() => setAll(true)} style={{ justifySelf: "start" }}>{x.showAllSteps(steps.length)}</button>}
        </div>
      )}
    </>
  );
}

function ExerciseImage({ src, label }: { src: string; label: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="card img">
      {failed
        ? <span style={{ display: "grid", justifyItems: "center", gap: 4 }}><IconImage style={{ width: 26, height: 26, opacity: .6 }} />{label}</span>
        : <img src={`/exercise-images/${src}`} alt={label} loading="lazy" onError={() => setFailed(true)} />}
    </div>
  );
}
