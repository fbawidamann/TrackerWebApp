import { macrosFor, type Food, type FoodEntry } from "@fitness/shared";
import { useState } from "react";
import { deleteEntry, logFood, updateEntry } from "@/db/nutrition";
import { useT } from "@/i18n";
import { parseAmount } from "@/lib/nutrition";
import { useFormat } from "@/lib/useFormat";
import { Sheet } from "@/ui/Sheet";
import { useToast } from "@/ui/Toast";

const pad = (n: number) => String(n).padStart(2, "0");
const timeValue = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/**
 * Amount sheet: big gram field (decimal keyboard), quick chips (portion / 100 / last amount), live kcal + macros, time.
 * New entry: `food` set. Edit: `entry` set (values scale from the snapshot).
 */
export function AmountSheet({ food, entry, day, lastAmount, onDone, onClose, onEditFood }: {
  food?: Food; entry?: FoodEntry; day: Date; lastAmount?: number;
  onDone: (name: string) => void; onClose: () => void; onEditFood?: () => void;
}) {
  const t = useT();
  const n = t.nutrition;
  const fmt = useFormat();
  const toast = useToast();
  const unit = entry?.unit ?? food?.unit ?? "g";
  const [amount, setAmount] = useState(() => String(entry?.amount ?? lastAmount ?? food?.portion ?? 100).replace(".", fmt.prefs.decimalSeparator === "comma" ? "," : "."));
  const initial = entry ? new Date(entry.eatenAt) : (() => {
    const now = new Date();
    return day.toDateString() === now.toDateString() ? now : new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12, 0);
  })();
  const [time, setTime] = useState(timeValue(initial));
  const value = parseAmount(amount);
  const per = entry
    ? { kcal: (entry.kcal / entry.amount) * 100, protein: (entry.protein / entry.amount) * 100, carbs: (entry.carbs / entry.amount) * 100, fat: (entry.fat / entry.amount) * 100 }
    : food!;
  const m = macrosFor(per, value ?? 0);
  const name = entry?.name ?? food!.name;
  const at = () => {
    const [h, mi] = time.split(":").map(Number);
    return new Date(initial.getFullYear(), initial.getMonth(), initial.getDate(), h || 0, mi || 0);
  };
  const g = (x: number) => fmt.num(Math.round(x * 10) / 10, 1);
  const chips: Array<[string, number]> = [];
  if (food?.portion) chips.push([n.portion(`${fmt.num(food.portion, 1)} ${unit}`), food.portion]);
  if (lastAmount && lastAmount !== food?.portion) chips.push([n.lastAmount(`${fmt.num(lastAmount, 1)} ${unit}`), lastAmount]);
  chips.push([`100 ${unit}`, 100]);

  const save = async () => {
    if (!value) return;
    if (entry) await updateEntry(entry.id, value, at());
    else await logFood(food!, value, at());
    navigator.vibrate?.(10);
    onDone(name);
  };

  return (
    <Sheet onClose={onClose} label={name}>
      <div className="amount-head">
        <h3>{name}</h3>
        {food?.brand && <p className="sub" style={{ margin: 0 }}>{food.brand}</p>}
      </div>
      <div className="amount-row">
        <label className="amount-field">
          <span className="lbl">{n.amount}</span>
          <span className="amount-input">
            <input className="field big" inputMode="decimal" enterKeyHint="done" value={amount} autoFocus
              onFocus={(e) => e.currentTarget.select()} onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void save(); }} aria-label={`${n.amount} (${unit})`} />
            <span className="u">{unit}</span>
          </span>
        </label>
        <label className="amount-field time">
          <span className="lbl">{n.time}</span>
          <input className="field" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
      </div>
      <div className="chips" role="group" aria-label={n.amount}>
        {chips.map(([label, v]) => (
          <button key={label} type="button" className="chip" aria-pressed={value === v} onClick={() => setAmount(String(v))}>{label}</button>
        ))}
      </div>
      <dl className="macro-live" aria-live="polite">
        <div className="hl"><dt>{n.protein}</dt><dd>{g(m.protein)} g</dd></div>
        <div><dt>{n.kcal}</dt><dd>{fmt.num(Math.round(m.kcal), 0)}</dd></div>
        <div><dt>{n.carbs}</dt><dd>{g(m.carbs)} g</dd></div>
        <div><dt>{n.fat}</dt><dd>{g(m.fat)} g</dd></div>
      </dl>
      <button type="button" className="btn btn-primary btn-block" disabled={!value} onClick={() => void save()}>
        {entry ? n.saveChanges : n.addN(fmt.num(Math.round(m.kcal), 0))}
      </button>
      {entry && (
        <button type="button" className="btn btn-danger btn-block" onClick={async () => {
          const undo = await deleteEntry(entry.id);
          onClose();
          toast(n.deleted, undo);
        }}>{n.deleteEntry}</button>
      )}
      {!entry && onEditFood && <button type="button" className="ghost" style={{ justifySelf: "center" }} onClick={onEditFood}>{n.editFood}</button>}
    </Sheet>
  );
}
