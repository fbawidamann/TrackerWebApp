import { EQUIPMENT, MUSCLE_GROUPS, MUSCLE_TO_GROUP, MUSCLES, type Exercise, type Muscle, type TrackingType } from "@fitness/shared";
import { useEffect, useState } from "react";
import { createCustomExercise, exerciseUsageCount, updateCustomExercise } from "@/db/actions";
import { useCatalog } from "@/data/hooks";
import { useT } from "@/i18n";
import { normalize } from "@/lib/labels";
import { IconClose } from "@/ui/icons";
import { Overlay } from "@/ui/Overlay";

const TYPES: TrackingType[] = ["weight_reps", "reps_only", "duration", "weight_duration"];

/** Create or edit a custom exercise (docs/design/screens/exercises.md → "Create / edit custom exercise"). */
export function ExerciseForm({ edit, initialName = "", onClose, onSaved }: {
  edit?: Exercise; initialName?: string; onClose: () => void; onSaved: (id: string) => void;
}) {
  const catalog = useCatalog();
  const t = useT();
  const x = t.exercises;
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
    <Overlay label={edit ? x.editExercise : x.newExercise} onEscape={onClose}>
      <div className="ov-head">
        <button type="button" className="ib" onClick={onClose} aria-label={t.common.cancel}><IconClose /></button>
        <h2>{edit ? x.editExercise : x.newExercise}</h2>
        <button type="button" className="tbtn save" disabled={!name.trim()} onClick={() => void save()}>{t.common.save}</button>
      </div>
      <div className="ov-body">
        <div className="ov-inner" style={{ gap: 24 }}>
          <div className="grp">
            <label className="lbl" htmlFor="ex-name">{t.common.name}</label>
            <input id="ex-name" className="field" maxLength={60} autoComplete="off" autoFocus value={name} placeholder={x.namePlaceholder} onChange={(e) => setName(e.target.value)} />
            {dup && <p className="warn">{x.exists(name.trim(), t.equipment[equipment])}</p>}
          </div>
          <div className="grp">
            <span className="lbl">{x.equipment}</span>
            <div className="chips">
              {EQUIPMENT.map((q) => <button key={q} type="button" className="chip" aria-pressed={equipment === q} onClick={() => setEquipment(q)}>{t.equipment[q]}</button>)}
            </div>
          </div>
          <div className="grp">
            <label className="lbl" htmlFor="ex-muscle">{x.primaryMuscle}</label>
            <select id="ex-muscle" className="field" value={muscle} onChange={(e) => setMuscle(e.target.value as Muscle)}>
              {MUSCLE_GROUPS.filter((g) => g !== "Other").map((g) => (
                <optgroup key={g} label={t.group[g]}>
                  {MUSCLES.filter((m) => MUSCLE_TO_GROUP[m] === g).map((m) => <option key={m} value={m}>{t.muscle[m]}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="grp">
            <span className="lbl">{x.type}</span>
            <div className="chips">
              {TYPES.map((k) => <button key={k} type="button" className="chip" disabled={used > 0} aria-pressed={type === k} onClick={() => setType(k)}>{t.tracking[k]}</button>)}
            </div>
            {used > 0 && <p className="hint">{x.usedInWorkouts}</p>}
          </div>
        </div>
      </div>
    </Overlay>
  );
}
