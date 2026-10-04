import { gainHint } from "@fitness/shared";
import { useState } from "react";
import { deleteWeight, saveWeight } from "@/db/nutrition";
import { useSettings } from "@/data/hooks";
import { useT } from "@/i18n";
import { parseAmount, type WeightInfo } from "@/lib/nutrition";
import { useFormat } from "@/lib/useFormat";
import { IconPlus } from "@/ui/icons";
import { Sheet } from "@/ui/Sheet";
import { Sparkline } from "@/ui/Sparkline";
import { useToast } from "@/ui/Toast";

/** Bodyweight: latest value, change per week (7-day average) with a calm hint vs. the target, trend sparkline. */
export function WeightCard({ info }: { info: WeightInfo }) {
  const t = useT();
  const n = t.nutrition;
  const fmt = useFormat();
  const s = useSettings();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [kg, setKg] = useState("");
  const hint = gainHint(info.perWeek, s.weightGainTarget);
  const sign = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${fmt.num(Math.abs(Math.round(v * 100) / 100), 2)}`;
  const recent = info.trend.slice(-30);

  return (
    <div className="sec">
      <div className="sec-head">
        <span className="lbl">{n.weight}</span>
        <button type="button" className="link" onClick={() => { setKg(info.latest ? String(info.latest.kg).replace(".", fmt.prefs.decimalSeparator === "comma" ? "," : ".") : ""); setOpen(true); }}>
          {n.logWeight}
        </button>
      </div>
      <div className="card weight-card">
        {info.latest ? (
          <>
            <div className="weight-top">
              <span><b className="weight-kg">{fmt.num(info.latest.kg, 1)}</b> kg</span>
              {info.perWeek !== null && <span className="muted">{n.perWeek(sign(info.perWeek))}</span>}
            </div>
            {recent.length >= 2 && (
              <div className="weight-spark"><Sparkline values={recent.map((p) => p.avg)} label={n.trend} w={300} h={48} /></div>
            )}
            <span className="small muted">{n.trend} · {fmt.shortDate(new Date(info.latest.measuredAt))}</span>
            {hint && <p className="hint weight-hint">{hint === "slow" ? n.gainSlow : n.gainFast}</p>}
          </>
        ) : (
          <button type="button" className="weight-empty" onClick={() => setOpen(true)}><IconPlus />{n.noWeight}</button>
        )}
      </div>
      {open && (
        <Sheet onClose={() => setOpen(false)} label={n.logWeight}>
          <h3>{n.logWeight}</h3>
          <label className="form-field">
            <span className="lbl">{n.weightKg}</span>
            <input className="field big" inputMode="decimal" value={kg} autoFocus onFocus={(e) => e.currentTarget.select()} onChange={(e) => setKg(e.target.value)} />
          </label>
          <button type="button" className="btn btn-primary btn-block" disabled={!(parseAmount(kg) && parseAmount(kg)! >= 20 && parseAmount(kg)! <= 400)}
            onClick={async () => { await saveWeight(parseAmount(kg)!, new Date()); setOpen(false); }}>{t.common.save}</button>
          {info.latest && new Date(info.latest.measuredAt).toDateString() === new Date().toDateString() && (
            <button type="button" className="btn btn-danger btn-block" onClick={async () => {
              const undo = await deleteWeight(info.latest!.id);
              setOpen(false);
              toast(n.deleted, undo);
            }}>{t.common.delete}</button>
          )}
        </Sheet>
      )}
    </div>
  );
}
