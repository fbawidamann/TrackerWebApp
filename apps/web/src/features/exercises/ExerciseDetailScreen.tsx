import { toDisplayWeight, type Exercise } from "@fitness/shared";
import { useNavigate, useParams, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { deleteCustomExercise, exerciseUsageCount, setExerciseHidden } from "@/db/actions";
import { muscleGroup, useCatalog, useTraining } from "@/data/hooks";
import { cap, EQUIPMENT_LABEL, TRACKING_LABEL } from "@/lib/labels";
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
  const e = catalog.byId.get(exerciseId);
  const sessions = useMemo(() => training.sessionsByExercise.get(exerciseId) ?? [], [training, exerciseId]);
  const [tab, setTab] = useState<Tab | null>(null);
  const [menu, setMenu] = useState(false);
  const [edit, setEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  if (!catalog.loaded || !training.loaded) return <div className="page" />;
  if (!e) return <div className="page"><p className="muted">Exercise not found.</p></div>;
  const activeTab: Tab = tab ?? (sessions.length ? "progress" : "about");
  const hidden = catalog.hidden.has(e.id);
  const openWorkout = (id: string) => void navigate({ to: "/history/$activityId", params: { activityId: id } });

  const toggleHidden = async () => {
    await setExerciseHidden(e.id, !hidden);
    toast(hidden ? "Exercise visible again" : "Hidden. Find it with Filter → Show hidden.");
  };

  return (
    <div className="page tight">
      <div className="topbar">
        <button type="button" className="ib" onClick={() => router.history.back()} aria-label="Back"><IconBack /></button>
        <button type="button" className="ib" onClick={() => setMenu(true)} aria-label="Exercise options"><IconMore /></button>
      </div>
      <div>
        <h1 className="title">{e.name}</h1>
        <p className="sub">{EQUIPMENT_LABEL[e.equipment]} · {muscleGroup(e)}{hidden ? " · Hidden" : ""}</p>
      </div>
      <div className="seg" role="tablist" aria-label="Exercise sections">
        {(["progress", "history", "about"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={activeTab === t} onClick={() => setTab(t)}>{cap(t)}</button>
        ))}
      </div>
      {activeTab === "progress" && <ProgressTab exercise={e} sessions={sessions} prEvents={training.prEvents} fmt={fmt} onOpen={openWorkout} />}
      {activeTab === "history" && <HistoryTab exercise={e} sessions={sessions} prEvents={training.prEvents} fmt={fmt} onOpen={openWorkout} />}
      {activeTab === "about" && <AboutTab exercise={e} />}

      {menu && (
        <MenuSheet title={e.name} onClose={() => setMenu(false)} items={[
          ...(e.isCustom ? [{ label: "Edit", onSelect: () => setEdit(true) }] : []),
          { label: hidden ? "Unhide exercise" : "Hide exercise", onSelect: () => void toggleHidden() },
          ...(e.isCustom ? [{ label: "Delete", danger: true, onSelect: () => void exerciseUsageCount(e.id).then(setConfirmDelete) }] : []),
        ]} />
      )}
      {confirmDelete !== null && (
        <ConfirmSheet title={`Delete ${e.name}?`} danger confirm="Delete"
          text={confirmDelete ? `Used in ${confirmDelete} ${confirmDelete === 1 ? "workout" : "workouts"}. It will be removed from lists; your history stays.` : "It will be removed from all lists."}
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => void deleteCustomExercise(e.id).then(() => { toast("Exercise deleted"); void navigate({ to: "/exercises" }); })} />
      )}
      {edit && <ExerciseForm edit={e} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); toast("Saved"); }} />}
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
  const prs = prEvents.filter((p) => p.exerciseId === exercise.id);
  if (!all.length) return <div className="card empty"><p>No sessions yet</p></div>;
  if (timed) return <div className="card empty"><p>{all.length} {all.length === 1 ? "session" : "sessions"}. Timed exercises have no chart.</p></div>;

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
        {repsOnly ? <span className="lbl">Best set reps</span> : (
          <div className="seg inline" role="group" aria-label="Chart metric">
            <button type="button" aria-pressed={m === "w"} onClick={() => { setMetric("w"); setSel(null); }}>Weight</button>
            <button type="button" aria-pressed={m === "r"} onClick={() => { setMetric("r"); setSel(null); }}>Reps</button>
          </div>
        )}
        <div className="mini-seg" role="group" aria-label="Time range">
          {(["3M", "6M", "1Y", "All"] as const).map((r) => <button key={r} type="button" aria-pressed={range === r} onClick={() => { setRange(r); setSel(null); }}>{r}</button>)}
        </div>
      </div>
      <div className="readout" aria-live="polite">
        {sp && <><b>{m === "w" ? <span className="nw">{fmt.num(sp.value, 1)}<span className="u">{fmt.unit}</span></span> : <span className="nw">{sp.value}<span className="u">reps</span></span>}</b>{fmt.date(sp.date)}</>}
      </div>
      <div className="card chart">
        <LineChart points={points} from={from} to={now} selected={selected} onSelect={setSel}
          steps={m === "w" ? [1, 2.5, 5, 10, 20, 25, 50, 100] : [1, 2, 5, 10, 20]}
          format={(v) => fmt.num(v, 1)} label={m === "w" ? "Heaviest weight per session" : "Best set reps per session"} />
      </div>
      <div className="card stats two">
        {repsOnly || !heaviest
          ? <div className="stat"><span className="stat-v">{all.length}</span><span className="lbl">Sessions</span></div>
          : <div className="stat"><span className="stat-v">{fmt.weightValue(heaviest.v)}<span className="u">{fmt.unit}</span></span><span className="lbl">Heaviest · {fmt.relDay(heaviest.d)}</span></div>}
        <div className="stat"><span className="stat-v">{bestReps}<span className="u">reps</span></span><span className="lbl">Best set</span></div>
      </div>
      {prs.length > 0 && (
        <div className="sec">
          <span className="lbl">PR history</span>
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
                <span className="li-side">was {fmt.weight(p.previous)}</span>
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
  if (!all.length) return <div className="card empty"><p>No sessions yet</p></div>;
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
      {list.length > limit && <button type="button" className="ghost" onClick={() => setLimit(limit + 20)} style={{ justifySelf: "center" }}>Show more</button>}
    </>
  );
}

function AboutTab({ exercise }: { exercise: Exercise }) {
  const [all, setAll] = useState(false);
  const rows: Array<[string, string, boolean?]> = [
    ["Primary muscle", cap(exercise.primaryMuscle)],
    ...(exercise.secondaryMuscles.length ? [["Secondary", exercise.secondaryMuscles.map(cap).join(", "), true] as [string, string, boolean]] : []),
    ["Equipment", EQUIPMENT_LABEL[exercise.equipment]],
    ...(exercise.level ? [["Level", cap(exercise.level)] as [string, string]] : []),
    ["Type", TRACKING_LABEL[exercise.trackingType]],
  ];
  const steps = exercise.instructions;
  return (
    <>
      {!exercise.isCustom && exercise.images.length > 0 && (
        <div className="imgs">
          {exercise.images.slice(0, 2).map((src, i) => <ExerciseImage key={src} src={src} label={i === 0 ? "Start position" : "End position"} />)}
        </div>
      )}
      <div className="card kv">
        {rows.map(([k, v, muted]) => (
          <div className="kv-row" key={k}><span className="k">{k}</span><span className="v" style={muted ? { color: "var(--muted)" } : undefined}>{v}</span></div>
        ))}
      </div>
      {steps.length > 0 && (
        <div className="sec">
          <span className="lbl">Instructions</span>
          <ol className="steps-list">{(all ? steps : steps.slice(0, 3)).map((s, i) => <li key={i}>{s}</li>)}</ol>
          {steps.length > 3 && !all && <button type="button" className="ghost" onClick={() => setAll(true)} style={{ justifySelf: "start" }}>Show all {steps.length} steps</button>}
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
