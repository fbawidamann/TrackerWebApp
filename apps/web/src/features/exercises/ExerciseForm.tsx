import { EQUIPMENT, MUSCLE_GROUPS, MUSCLE_TO_GROUP, MUSCLES, type Exercise, type Muscle, type TrackingType } from "@fitness/shared";
import { useEffect, useState } from "react";
import { createCustomExercise, exerciseUsageCount, updateCustomExercise } from "@/db/actions";
import { useCatalog } from "@/data/hooks";
import { cap, EQUIPMENT_LABEL, normalize } from "@/lib/labels";
import { IconClose } from "@/ui/icons";
import { Overlay } from "@/ui/Overlay";

const TYPES: Array<[TrackingType, string]> = [["weight_reps", "Weight & reps"], ["reps_only", "Reps only"], ["duration", "Time"], ["weight_duration", "Weight & time"]];

/** Create or edit a custom exercise (docs/design/screens/exercises.md → "Create / edit custom exercise"). */
export function ExerciseForm({ edit, initialName = "", onClose, onSaved }: {
  edit?: Exercise; initialName?: string; onClose: () => void; onSaved: (id: string) => void;
}) {
  const catalog = useCatalog();
  const [name, setName] = useState(edit?.name ?? initialName);
  const [equipment, setEquipment] = useState<Exercise["equipment"]>(edit?.equipment ?? "barbell");
  const [muscle, setMuscle] = useState<Muscle>(edit?.primaryMuscle ?? "chest");
  const [type, setType] = useState<TrackingType>(edit?.trackingType ?? "weight_reps");
  const [used, setUsed] = useState(0);
  useEffect(() => { if (edit) void exerciseUsageCount(edit.id).then(setUsed); }, [edit]);

  const dup = name.trim() && catalog.list.some((e) => e.id !== edit?.id && normalize(e.name) === normalize(name) && e.equipment === equipment);
  const save = async () => {
    if (!name.trim()) return;
    const input = { name, equipment, primaryMuscle: muscle, trackingType: type };
    if (edit) { await updateCustomExercise(edit.id, input); onSaved(edit.id); }
    else onSaved(await createCustomExercise(input));
  };

  return (
    <Overlay label={edit ? "Edit exercise" : "New exercise"} onEscape={onClose}>
      <div className="ov-head">
        <button type="button" className="ib" onClick={onClose} aria-label="Cancel"><IconClose /></button>
        <h2>{edit ? "Edit exercise" : "New exercise"}</h2>
        <button type="button" className="tbtn save" disabled={!name.trim()} onClick={() => void save()}>Save</button>
      </div>
      <div className="ov-body">
        <div className="ov-inner" style={{ gap: 24 }}>
          <div className="grp">
            <label className="lbl" htmlFor="ex-name">Name</label>
            <input id="ex-name" className="field" maxLength={60} autoComplete="off" autoFocus value={name} placeholder="e.g. Cable Lateral Raise" onChange={(e) => setName(e.target.value)} />
            {dup && <p className="warn">{name.trim()} ({EQUIPMENT_LABEL[equipment]}) already exists</p>}
          </div>
          <div className="grp">
            <span className="lbl">Equipment</span>
            <div className="chips">
              {EQUIPMENT.map((q) => <button key={q} type="button" className="chip" aria-pressed={equipment === q} onClick={() => setEquipment(q)}>{EQUIPMENT_LABEL[q]}</button>)}
            </div>
          </div>
          <div className="grp">
            <label className="lbl" htmlFor="ex-muscle">Primary muscle</label>
            <select id="ex-muscle" className="field" value={muscle} onChange={(e) => setMuscle(e.target.value as Muscle)}>
              {MUSCLE_GROUPS.filter((g) => g !== "Other").map((g) => (
                <optgroup key={g} label={g}>
                  {MUSCLES.filter((m) => MUSCLE_TO_GROUP[m] === g).map((m) => <option key={m} value={m}>{cap(m)}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="grp">
            <span className="lbl">Type</span>
            <div className="chips">
              {TYPES.map(([k, l]) => <button key={k} type="button" className="chip" disabled={used > 0} aria-pressed={type === k} onClick={() => setType(k)}>{l}</button>)}
            </div>
            {used > 0 && <p className="hint">Used in workouts</p>}
          </div>
        </div>
      </div>
    </Overlay>
  );
}
