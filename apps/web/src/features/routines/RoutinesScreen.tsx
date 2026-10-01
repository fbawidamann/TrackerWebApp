import { useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { deleteRoutine, duplicateRoutine, renameRoutine, reorder } from "@/db/actions";
import { lastDoneByRoutine, useCatalog, useRoutines, useTraining, type RoutineView } from "@/data/hooks";
import { useStarter } from "@/features/workout/useStarter";
import { useT } from "@/i18n";
import { useFormat } from "@/lib/useFormat";
import { IconBack, IconMore, IconPlus } from "@/ui/icons";
import { ReorderList } from "@/ui/ReorderList";
import { ConfirmSheet, MenuSheet, Sheet, TextSheet } from "@/ui/Sheet";
import { useToast } from "@/ui/Toast";
import { RoutinePreview } from "./RoutinePreview";
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
  const t = useT();
  const r9 = t.routines;
  const { start, element } = useStarter();
  const [preview, setPreview] = useState<RoutineView | null>(null);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [reordering, setReordering] = useState(false);
  const last = lastDoneByRoutine(training);

  const shareText = (v: RoutineView) => [v.routine.name, ...v.items.flatMap((i, n) => {
    const ex = catalog.byId.get(i.exerciseId);
    const line = `${n + 1}. ${ex?.name ?? t.common.exercise}${ex ? ` (${t.equipment[ex.equipment]})` : ""} · ${r9.setsText(i.warmupSets, i.workingSets)}`;
    return i.note ? [line, `   ${r9.noteLine(i.note)}`] : [line];
  })].join("\n");
  const share = async (v: RoutineView) => {
    const text = shareText(v);
    try { await navigator.clipboard.writeText(text); toast(r9.copied); } catch { setSheet({ kind: "share", text }); }
  };

  if (routines === undefined) return <div className="page" />;
  if (reordering) {
    return (
      <div className="page tight">
        <div className="ehead" style={{ padding: 0, margin: "-6px -8px -10px" }}>
          <span style={{ width: 60 }} /><h1>{r9.changeOrder}</h1>
          <button type="button" className="tbtn save" onClick={() => setReordering(false)}>{t.common.done}</button>
        </div>
        <p className="hint">{r9.dragHandles}</p>
        <ReorderList items={routines.map((r) => ({ id: r.routine.id, label: r.routine.name }))} onChange={(ids) => void reorder("routines", ids)} />
      </div>
    );
  }

  return (
    <div className="page tight">
      <div className="topbar">
        <button type="button" className="ib" onClick={() => router.history.back()} aria-label={t.common.back}><IconBack /></button>
        <span className="t">{r9.routines}</span>
        <button type="button" className="ib" onClick={() => void navigate({ to: "/routines/new" })} aria-label={r9.newRoutine}><IconPlus /></button>
      </div>
      {routines.length ? (
        <>
          <div className="card list">
            {routines.map((r) => (
              <div className="li" key={r.routine.id} style={{ paddingBlock: 10 }}>
                <button type="button" className="li-main" style={{ textAlign: "left", paddingBlock: 4 }} onClick={() => setPreview(r)}>
                  <span className="li-name">{r.routine.name}</span>
                  <span className="li-meta">{r9.meta(r.items.length, r.setCount, last.get(r.routine.id) ? t.home.lastDone(fmt.relDay(last.get(r.routine.id)!)) : t.home.neverDone)}</span>
                </button>
                <button type="button" className="ib" style={{ marginRight: -10 }} onClick={() => setSheet({ kind: "menu", view: r })} aria-label={r9.options(r.routine.name)}><IconMore /></button>
              </div>
            ))}
          </div>
          {routines.length > 1 && <button type="button" className="ghost" style={{ justifySelf: "center" }} onClick={() => setReordering(true)}>{r9.changeOrder}</button>}
        </>
      ) : (
        <>
          <StarterRoutines />
          <button type="button" className="btn btn-block" onClick={() => void navigate({ to: "/routines/new" })}>{r9.createRoutine}</button>
        </>
      )}

      {preview && <RoutinePreview view={preview} lastDone={last.get(preview.routine.id)} onStart={() => void start({ routineId: preview.routine.id })} onClose={() => setPreview(null)} />}
      {sheet?.kind === "menu" && (
        <MenuSheet title={sheet.view.routine.name} onClose={() => setSheet(null)} items={[
          { label: r9.rename, onSelect: () => setSheet({ kind: "rename", view: sheet.view }) },
          { label: r9.duplicate, onSelect: () => void duplicateRoutine(sheet.view.routine.id).then(() => toast(r9.duplicated)) },
          { label: r9.share, onSelect: () => void share(sheet.view) },
          { label: t.common.delete, danger: true, onSelect: () => setSheet({ kind: "delete", view: sheet.view }) },
        ]} />
      )}
      {sheet?.kind === "rename" && (
        <TextSheet title={r9.rename} initial={sheet.view.routine.name} maxLength={40} onClose={() => setSheet(null)} onSave={(v) => void renameRoutine(sheet.view.routine.id, v)} />
      )}
      {sheet?.kind === "delete" && (
        <ConfirmSheet title={r9.deleteTitle(sheet.view.routine.name)} text={r9.deleteText} confirm={r9.deleteRoutine} danger onClose={() => setSheet(null)}
          onConfirm={() => void deleteRoutine(sheet.view.routine.id).then((undo) => toast(r9.deleted, undo))} />
      )}
      {sheet?.kind === "share" && (
        <Sheet onClose={() => setSheet(null)} label={r9.share}>
          <h3>{r9.share}</h3>
          <p>{r9.shareHint}</p>
          <textarea className="field" readOnly rows={8} defaultValue={sheet.text} style={{ fontSize: 14 }} onFocus={(e) => e.currentTarget.select()} autoFocus />
        </Sheet>
      )}
      {element}
    </div>
  );
}
