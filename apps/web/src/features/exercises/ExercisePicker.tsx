import { useState } from "react";
import { useT } from "@/i18n";
import { IconClose, IconPlus } from "@/ui/icons";
import { Overlay } from "@/ui/Overlay";
import { ExerciseBrowser } from "./ExerciseBrowser";
import { ExerciseForm } from "./ExerciseForm";

/** Full-screen picker: multi-select ("Add 3") or single choice (Replace). */
export function ExercisePicker({ mode, onDone, onClose }: {
  mode: "multi" | "single"; onDone: (ids: string[]) => void; onClose: () => void;
}) {
  const t = useT();
  const x = t.exercises;
  const [sel, setSel] = useState<string[]>([]);
  const [create, setCreate] = useState<string | null>(null);
  const title = mode === "multi" ? x.addExercises : x.replaceExercise;
  return (
    <Overlay label={title} onEscape={onClose}>
      <div className="ov-head">
        <button type="button" className="ib" onClick={onClose} aria-label={t.common.close}><IconClose /></button>
        <h2>{title}</h2>
        <button type="button" className="ib" onClick={() => setCreate("")} aria-label={x.createExercise}><IconPlus /></button>
      </div>
      <div className="ov-body">
        <div style={{ maxWidth: 640, margin: "0 auto", paddingBottom: 24 }}>
          <ExerciseBrowser scope="picker" head={null} mode={mode} selected={sel}
            onRow={(id) => (mode === "single" ? onDone([id]) : setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])))}
            onCreate={(name) => setCreate(name)} />
        </div>
      </div>
      {mode === "multi" && (
        <div className="ov-foot">
          <button type="button" className="btn btn-primary btn-block" disabled={!sel.length} onClick={() => onDone(sel)}>
            {sel.length ? x.addN(sel.length) : x.selectExercises}
          </button>
        </div>
      )}
      {create !== null && (
        <ExerciseForm initialName={create} onClose={() => setCreate(null)}
          onSaved={(id) => { setCreate(null); if (mode === "single") onDone([id]); else setSel((s) => [...s, id]); }} />
      )}
    </Overlay>
  );
}
