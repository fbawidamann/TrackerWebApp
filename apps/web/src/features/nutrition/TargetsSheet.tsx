import { bmr, nutritionTargets, ACTIVITY_FACTORS } from "@fitness/shared";
import { useState, type ReactNode } from "react";
import { updateSettings } from "@/db/actions";
import { useSettings } from "@/data/hooks";
import { useT } from "@/i18n";
import { targetsFor, type WeightInfo } from "@/lib/nutrition";
import { useFormat } from "@/lib/useFormat";
import { Sheet } from "@/ui/Sheet";

const toInt = (s: string): number | null => {
  const v = Number(s.trim().replace(",", "."));
  return s.trim() && Number.isFinite(v) ? Math.round(v) : null;
};

/**
 * Targets: protein first (g/kg chips 1.5–2.2 or own grams), kcal (suggestion from body data or own), body data,
 * weekly gain target. Everything saves immediately; the suggestion is shown with its formula.
 */
export function TargetsSheet({ info, onClose }: { info: WeightInfo; onClose: () => void }) {
  const t = useT();
  const n = t.nutrition;
  const fmt = useFormat();
  const s = useSettings();
  const set = (c: Parameters<typeof updateSettings>[0]) => void updateSettings(c);
  const [own, setOwn] = useState({ protein: s.proteinTargetG?.toString() ?? "", kcal: s.kcalTarget?.toString() ?? "" });
  const [body, setBody] = useState({ birthYear: s.birthYear?.toString() ?? "", heightCm: s.heightCm?.toString() ?? "", gain: String(s.weightGainTarget) });
  const weightKg = info.trend.length ? Math.round(info.trend[info.trend.length - 1]!.avg * 10) / 10 : null;
  const target = targetsFor(s, info);
  const suggested = nutritionTargets({ kcalTarget: null, kcalSurplus: s.kcalSurplus, proteinPerKg: s.proteinPerKg, proteinTargetG: null },
    { sex: s.sex, birthYear: s.birthYear, heightCm: s.heightCm, activity: s.activityLevel, weightKg });
  const hasBmr = bmr({ sex: s.sex, birthYear: s.birthYear, heightCm: s.heightCm, activity: s.activityLevel, weightKg }) !== null;

  const block = (title: string, children: ReactNode) => <div className="sec"><span className="lbl">{title}</span>{children}</div>;
  const numField = (label: string, value: string, onChange: (v: string) => void, onBlur: () => void, placeholder?: string) => (
    <label className="form-field">
      <span className="small muted">{label}</span>
      <input className="field" inputMode="decimal" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} />
    </label>
  );

  return (
    <Sheet onClose={onClose} label={n.targets}>
      <h3>{n.targets}</h3>

      {block(n.protein, <>
        <div className="chips" role="group" aria-label={n.proteinPerKg}>
          {[1.5, 1.6, 1.8, 2.0, 2.2].map((v) => (
            <button key={v} type="button" className="chip" aria-pressed={s.proteinTargetG === null && s.proteinPerKg === v}
              onClick={() => { setOwn((o) => ({ ...o, protein: "" })); set({ proteinPerKg: v, proteinTargetG: null }); }}>
              {fmt.num(v, 1)} g/kg
            </button>
          ))}
        </div>
        {weightKg !== null && s.proteinTargetG === null && <p className="hint">{n.proteinPerKgSub(fmt.num(weightKg, 1), Math.round((weightKg * s.proteinPerKg) / 5) * 5)}</p>}
        {numField(n.ownProtein, own.protein, (v) => setOwn((o) => ({ ...o, protein: v })), () => {
          const v = toInt(own.protein);
          set({ proteinTargetG: v !== null && v >= 20 && v <= 500 ? v : null });
        }, target?.protein ? String(target.protein) : undefined)}
      </>)}

      {block(n.kcal, <>
        {suggested?.kcal ? (
          <p className="hint"><b className="nw">{n.suggestion(suggested.kcal)}</b><br />{n.suggestionFormula}</p>
        ) : <p className="hint">{n.needBody}</p>}
        <div className="chips" role="group" aria-label={n.surplus}>
          {[0, 150, 250, 350, 500].map((v) => (
            <button key={v} type="button" className="chip" aria-pressed={s.kcalSurplus === v} onClick={() => set({ kcalSurplus: v })}>+{v}</button>
          ))}
        </div>
        {numField(n.ownKcal, own.kcal, (v) => setOwn((o) => ({ ...o, kcal: v })), () => {
          const v = toInt(own.kcal);
          set({ kcalTarget: v !== null && v >= 800 && v <= 8000 ? v : null });
        }, suggested?.kcal ? `${n.auto} · ${suggested.kcal}` : undefined)}
      </>)}

      {block(n.body, <>
        <div className="seg" role="group" aria-label={n.sex}>
          {(["male", "female"] as const).map((x) => (
            <button key={x} type="button" aria-pressed={s.sex === x} onClick={() => set({ sex: x })}>{x === "male" ? n.male : n.female}</button>
          ))}
        </div>
        <div className="form-grid">
          {numField(n.birthYear, body.birthYear, (v) => setBody((b) => ({ ...b, birthYear: v })), () => {
            const v = toInt(body.birthYear);
            set({ birthYear: v !== null && v >= 1900 && v <= new Date().getFullYear() ? v : null });
          }, "2003")}
          {numField(n.height, body.heightCm, (v) => setBody((b) => ({ ...b, heightCm: v })), () => {
            const v = toInt(body.heightCm);
            set({ heightCm: v !== null && v >= 100 && v <= 250 ? v : null });
          }, "180")}
        </div>
        <label className="form-field">
          <span className="small muted">{n.activity}</span>
          <select className="field" value={s.activityLevel} onChange={(e) => set({ activityLevel: Number(e.target.value) })}>
            {n.activityLevels.map((l, i) => <option key={i} value={i + 1}>{l} (×{ACTIVITY_FACTORS[i]})</option>)}
          </select>
        </label>
        {!hasBmr && weightKg === null && <p className="hint">{n.setTargetsHint}</p>}
      </>)}

      {block(n.weight, numField(n.gainTarget, body.gain, (v) => setBody((b) => ({ ...b, gain: v })), () => {
        const v = Number(body.gain.trim().replace(",", "."));
        if (Number.isFinite(v) && Math.abs(v) <= 1.5) set({ weightGainTarget: Math.round(v * 100) / 100 });
        else setBody((b) => ({ ...b, gain: String(s.weightGainTarget) }));
      }))}

      <button type="button" className="btn btn-primary btn-block" onClick={onClose}>{t.common.done}</button>
    </Sheet>
  );
}
