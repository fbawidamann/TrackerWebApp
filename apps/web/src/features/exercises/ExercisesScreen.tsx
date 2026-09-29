import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { IconPlus } from "@/ui/icons";
import { ExerciseBrowser } from "./ExerciseBrowser";
import { ExerciseForm } from "./ExerciseForm";

export function ExercisesScreen() {
  const navigate = useNavigate();
  const [create, setCreate] = useState<string | null>(null);
  const open = (id: string) => void navigate({ to: "/exercises/$exerciseId", params: { exerciseId: id } });
  return (
    <div className="plain">
      <ExerciseBrowser scope="tab" mode="browse" onRow={open} onCreate={setCreate}
        head={(
          <div className="plain-head">
            <div className="topbar" style={{ margin: 0 }}>
              <h1 className="title">Exercises</h1>
              <button type="button" className="ib" onClick={() => setCreate("")} aria-label="Create exercise" style={{ marginRight: -8 }}><IconPlus /></button>
            </div>
          </div>
        )} />
      {create !== null && <ExerciseForm initialName={create} onClose={() => setCreate(null)} onSaved={(id) => { setCreate(null); open(id); }} />}
    </div>
  );
}
