import type { Food } from "@fitness/shared";
import { useState } from "react";
import { deleteFood, saveFood, type FoodInput } from "@/db/nutrition";
import { useT } from "@/i18n";
import { parseAmount } from "@/lib/nutrition";
import { IconClose } from "@/ui/icons";
import { Overlay } from "@/ui/Overlay";
import { useToast } from "@/ui/Toast";

type Draft = Record<"name" | "brand" | "barcode" | "kcal" | "protein" | "carbs" | "fat" | "portion", string>;

const str = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

/** Create or edit an own food (values per 100 g/ml). kcal and protein are required, carbs/fat default to 0. */
export function FoodForm({ food, initial, onSaved, onClose }: {
  food?: Food; initial?: Partial<FoodInput>; onSaved: (id: string) => void; onClose: () => void;
}) {
  const t = useT();
  const n = t.nutrition;
  const toast = useToast();
  const src = food ?? initial ?? {};
  const [unit, setUnit] = useState<"g" | "ml">(src.unit ?? "g");
  const [d, setD] = useState<Draft>({
    name: src.name ?? "", brand: src.brand ?? "", barcode: src.barcode ?? "",
    kcal: str(src.kcal), protein: str(src.protein), carbs: str(src.carbs), fat: str(src.fat), portion: str(src.portion),
  });
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) => setD((x) => ({ ...x, [k]: e.target.value }));
  const num = (s: string) => (s.trim() === "" ? null : (Number(s.trim().replace(",", ".")) >= 0 ? Number(s.trim().replace(",", ".")) : NaN));
  const kcal = num(d.kcal), protein = num(d.protein), carbs = num(d.carbs), fat = num(d.fat);
  const macroOk = (v: number | null, max: number) => v === null || (Number.isFinite(v) && v <= max);
  const valid = d.name.trim().length > 0 && kcal !== null && protein !== null && macroOk(kcal, 1000)
    && macroOk(protein, 100) && macroOk(carbs, 100) && macroOk(fat, 100) && (d.barcode.trim() === "" || /^\d{6,14}$/.test(d.barcode.trim()));

  const save = async () => {
    if (!valid) return;
    const id = await saveFood(food?.id ?? null, {
      name: d.name, brand: d.brand || null, barcode: d.barcode || null, unit,
      kcal: kcal!, protein: protein!, carbs: carbs ?? 0, fat: fat ?? 0, portion: parseAmount(d.portion),
    });
    onSaved(id);
  };
  const field = (k: keyof Draft, label: string, opts: { need?: boolean; mode?: "decimal" | "numeric" | "text" } = {}) => (
    <label className="form-field">
      <span className="lbl">{label}</span>
      <input className={"field" + (opts.need && !d[k].trim() ? " need" : "")} inputMode={opts.mode ?? "decimal"} value={d[k]} onChange={set(k)} />
    </label>
  );
  const title = food ? n.editFoodTitle : n.newFood;
  return (
    <Overlay label={title} onEscape={onClose}>
      <div className="ov-head">
        <button type="button" className="ib" onClick={onClose} aria-label={t.common.close}><IconClose /></button>
        <h2>{title}</h2>
        <span style={{ width: 40 }} />
      </div>
      <div className="ov-body">
        <form className="ov-inner" onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <label className="form-field">
            <span className="lbl">{n.name}</span>
            <input className="field" value={d.name} onChange={set("name")} autoFocus={!food && !initial?.name} maxLength={80} />
          </label>
          {field("brand", n.brand, { mode: "text" })}
          <div className="seg" role="group" aria-label={n.unit}>
            {(["g", "ml"] as const).map((u) => <button key={u} type="button" aria-pressed={unit === u} onClick={() => setUnit(u)}>{u}</button>)}
          </div>
          <div className="sec">
            <span className="lbl">{n.valuesPer100(unit)}</span>
            <div className="form-grid">
              {field("kcal", n.kcal, { need: true })}
              {field("protein", `${n.protein} (g)`, { need: true })}
              {field("carbs", `${n.carbs} (g)`)}
              {field("fat", `${n.fat} (g)`)}
            </div>
          </div>
          <label className="form-field">
            <span className="lbl">{n.portionSize(unit)}</span>
            <input className="field" inputMode="decimal" value={d.portion} onChange={set("portion")} placeholder={n.portionHint} />
          </label>
          {field("barcode", n.barcode, { mode: "numeric" })}
          {food && <p className="hint">{n.pastStay}</p>}
          <button type="submit" className="btn btn-primary btn-block" disabled={!valid}>{t.common.save}</button>
          {food && (
            <button type="button" className="btn btn-danger btn-block" onClick={async () => {
              const undo = await deleteFood(food.id);
              onClose();
              toast(n.foodDeleted, undo);
            }}>{n.deleteFood}</button>
          )}
        </form>
      </div>
    </Overlay>
  );
}
