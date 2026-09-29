import { useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { deleteRoutine, duplicateRoutine, renameRoutine, reorder } from "@/db/actions";
import { lastDoneByRoutine, useCatalog, useRoutines, useTraining, type RoutineView } from "@/data/hooks";
import { useStarter } from "@/features/workout/useStarter";
import { EQUIPMENT_LABEL } from "@/lib/labels";
import { useFormat } from "@/lib/useFormat";
import { IconBack, IconMore, IconPlus } from "@/ui/icons";
import { ReorderList } from "@/ui/ReorderList";
import { ConfirmSheet, MenuSheet, Sheet, TextSheet } from "@/ui/Sheet";
import { useToast } from "@/ui/Toast";
import { RoutinePreview, setsText } from "./RoutinePreview";
import { StarterRoutines } from "./StarterRoutines";

type SheetState = { kind: "menu" | "rename" | "delete"; view: RoutineView } | { kind: "share"; text: string } | null;

export function RoutinesScreen() {
  const router = useRouter();
  const navigate = useNavigate();
  const toast = useToast();
  const routines = useRoutines();
  const training = useTraining();
  const catalog = useCatalog();
  const fmt = useFormat();
  const { start, element } = useStarter();
  const [preview, setPreview] = useState<RoutineView | null>(null);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [reordering, setReordering] = useState(false);
  const last = lastDoneByRoutine(training);

  const shareText = (v: RoutineView) => [v.routine.name, ...v.items.flatMap((i, n) => {
    const ex = catalog.byId.get(i.exerciseId);
    const line = `${n + 1}. ${ex?.name ?? "Exercise"}${ex ? ` (${EQUIPMENT_LABEL[ex.equipment]})` : ""} · ${setsText(i.warmupSets, i.workingSets)}`;
    return i.note ? [line, `   Note: ${i.note}`] : [line];
  })].join("\n");
  const share = async (v: RoutineView) => {
    const text = shareText(v);
    try { await navigator.clipboard.writeText(text); toast("Copied"); } catch { setSheet({ kind: "share", text }); }
  };

  if (routines === undefined) return <div className="page" />;
  if (reordering) {
    return (
      <div className="page tight">
        <div className="ehead" style={{ padding: 0, margin: "-6px -8px -10px" }}>
          <span style={{ width: 60 }} /><h1>Change order</h1>
          <button type="button" className="tbtn save" onClick={() => setReordering(false)}>Done</button>
        </div>
        <p className="hint">Drag the handles</p>
        <ReorderList items={routines.map((r) => ({ id: r.routine.id, label: r.routine.name }))} onChange={(ids) => void reorder("routines", ids)} />
      </div>
    );
  }

  return (
    <div className="page tight">
      <div className="topbar">
        <button type="button" className="ib" onClick={() => router.history.back()} aria-label="Back"><IconBack /></button>
        <span className="t">Routines</span>
        <button type="button" className="ib" onClick={() => void navigate({ to: "/routines/new" })} aria-label="New routine"><IconPlus /></button>
      </div>
      {routines.length ? (
        <>
          <div className="card list">
            {routines.map((r) => (
              <div className="li" key={r.routine.id} style={{ paddingBlock: 10 }}>
                <button type="button" className="li-main" style={{ textAlign: "left", paddingBlock: 4 }} onClick={() => setPreview(r)}>
                  <span className="li-name">{r.routine.name}</span>
                  <span className="li-meta">{r.items.length} exercises · {r.setCount} sets · {last.get(r.routine.id) ? "last " + fmt.relDay(last.get(r.routine.id)!) : "never done"}</span>
                </button>
                <button type="button" className="ib" style={{ marginRight: -10 }} onClick={() => setSheet({ kind: "menu", view: r })} aria-label={`${r.routine.name} options`}><IconMore /></button>
              </div>
            ))}
          </div>
          {routines.length > 1 && <button type="button" className="ghost" style={{ justifySelf: "center" }} onClick={() => setReordering(true)}>Change order</button>}
        </>
      ) : (
        <>
          <StarterRoutines />
          <button type="button" className="btn btn-block" onClick={() => void navigate({ to: "/routines/new" })}>Create routine</button>
        </>
      )}

      {preview && <RoutinePreview view={preview} lastDone={last.get(preview.routine.id)} onStart={() => void start({ routineId: preview.routine.id })} onClose={() => setPreview(null)} />}
      {sheet?.kind === "menu" && (
        <MenuSheet title={sheet.view.routine.name} onClose={() => setSheet(null)} items={[
          { label: "Rename", onSelect: () => setSheet({ kind: "rename", view: sheet.view }) },
          { label: "Duplicate", onSelect: () => void duplicateRoutine(sheet.view.routine.id).then(() => toast("Duplicated")) },
          { label: "Share", onSelect: () => void share(sheet.view) },
          { label: "Delete", danger: true, onSelect: () => setSheet({ kind: "delete", view: sheet.view }) },
        ]} />
      )}
      {sheet?.kind === "rename" && (
        <TextSheet title="Rename" initial={sheet.view.routine.name} maxLength={40} onClose={() => setSheet(null)} onSave={(v) => void renameRoutine(sheet.view.routine.id, v)} />
      )}
      {sheet?.kind === "delete" && (
        <ConfirmSheet title={`Delete ${sheet.view.routine.name}?`} text="Past workouts stay in History." confirm="Delete routine" danger onClose={() => setSheet(null)}
          onConfirm={() => void deleteRoutine(sheet.view.routine.id).then((undo) => toast("Routine deleted", undo))} />
      )}
      {sheet?.kind === "share" && (
        <Sheet onClose={() => setSheet(null)} label="Share">
          <h3>Share</h3>
          <p>Select the text and copy it.</p>
          <textarea className="field" readOnly rows={8} defaultValue={sheet.text} style={{ fontSize: 14 }} onFocus={(e) => e.currentTarget.select()} autoFocus />
        </Sheet>
      )}
      {element}
    </div>
  );
}
