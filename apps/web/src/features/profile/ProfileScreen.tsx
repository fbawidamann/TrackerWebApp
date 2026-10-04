import { ACCENTS as ACCENT_KEYS, formatClock, WEIGHT_STEPS_KG, weightStepInUnit, type Language, type UserSettings } from "@fitness/shared";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { ACCENTS } from "@/app/theme";
import { exportBackup, importBackup, parseBackup, updateDeviceSettings, updateSettings, type ParsedBackup } from "@/db/actions";
import { useAccount, useDeviceSettings, useSettings, useTraining } from "@/data/hooks";
import { useT } from "@/i18n";
import { useFormat } from "@/lib/useFormat";
import { IconCheck, IconChevron, IconExternal } from "@/ui/icons";
import { AccountSection } from "./AccountSection";
import { RadioSheet, Sheet, TextSheet } from "@/ui/Sheet";
import { useToast } from "@/ui/Toast";
import { canHaptic } from "@/lib/time";
import { StravaCard } from "@/features/strava/StravaCard";

type Picker = "goal" | "weekStart" | "defaultSets" | "step" | "rest" | "theme" | "date" | null;

export function ProfileScreen() {
  const s = useSettings();
  const account = useAccount();
  const device = useDeviceSettings();
  const training = useTraining();
  const fmt = useFormat();
  const t = useT();
  const p = t.profile;
  const toast = useToast();
  const [picker, setPicker] = useState<Picker>(null);
  const [rename, setRename] = useState(false);
  const [backup, setBackup] = useState<ParsedBackup & { ok: true } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (changes: Partial<UserSettings>) => void updateSettings(changes);

  const stats = useMemo(() => {
    const year = new Date().getFullYear();
    const first = training.workouts[training.workouts.length - 1]?.start;
    // Streak: consecutive weeks (ending now) in which the weekly goal was reached.
    const perWeek = new Map<number, number>();
    for (const w of training.workouts) {
      const k = fmt.weekStart(w.start).getTime();
      perWeek.set(k, (perWeek.get(k) ?? 0) + 1);
    }
    let streak = 0;
    let week = fmt.weekStart(new Date());
    if ((perWeek.get(week.getTime()) ?? 0) < s.weeklyGoal) week = new Date(week.getFullYear(), week.getMonth(), week.getDate() - 7);
    while ((perWeek.get(week.getTime()) ?? 0) >= s.weeklyGoal) {
      streak++;
      week = new Date(week.getFullYear(), week.getMonth(), week.getDate() - 7);
    }
    return { total: training.workouts.length, year: training.workouts.filter((w) => w.start.getFullYear() === year).length, streak, first };
  }, [training.workouts, s.weeklyGoal, fmt]);

  const doExport = async () => {
    const json = await exportBackup();
    const name = `fitness-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([json], name, { type: "application/json" });
    try {
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: name }); toast(p.backupSaved); return; }
    } catch { /* share cancelled: fall back to download */ }
    const url = URL.createObjectURL(file);
    const a = Object.assign(document.createElement("a"), { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(p.backupSaved);
  };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const parsed = parseBackup(await f.text());
    if (parsed.ok) setBackup(parsed); else toast(p.invalidBackup);
    if (fileRef.current) fileRef.current.value = "";
  };

  const toggle = (label: string, value: boolean, onChange: (v: boolean) => void, sub?: string) => (
    <button type="button" className="row" role="switch" aria-checked={value} onClick={() => onChange(!value)}>
      <span>{label}{sub && <span className="row-sub">{sub}</span>}</span><span className="sw" />
    </button>
  );
  const pick = (label: string, value: ReactNode, p: Picker) => (
    <button type="button" className="row" onClick={() => setPicker(p)}><span>{label}</span><span className="val">{value}<IconChevron /></span></button>
  );
  const seg = <T extends string>(label: string, value: T, options: Array<[T, string]>, onChange: (v: T) => void) => (
    <div className="row">
      <span>{label}</span>
      <span className="seg inline" role="group" aria-label={label}>
        {options.map(([v, l]) => <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>)}
      </span>
    </div>
  );
  const section = (title: string, children: ReactNode) => <div className="sec"><span className="lbl">{title}</span><div className="card rows">{children}</div></div>;
  const stepLabel = (kg: number) => `${fmt.num(weightStepInUnit({ weightUnit: s.weightUnit, weightStepKg: kg as UserSettings["weightStepKg"] }))} ${s.weightUnit}`;
  const exampleDate = new Date(new Date().getFullYear(), 8, 29);

  return (
    <div className="page">
      <div>
        {account ? <h1 className="title">{account.username}</h1> : (
          <button type="button" onClick={() => setRename(true)} aria-label={p.changeName} style={{ display: "block", textAlign: "left" }}>
            <h1 className="title" style={s.displayName ? undefined : { color: "var(--muted)" }}>{s.displayName || p.yourName}</h1>
          </button>
        )}
        {stats.first && <p className="sub">{p.since(fmt.month(stats.first.getMonth()), stats.first.getFullYear())}</p>}
      </div>
      <div className="card stats eq">
        <div className="stat"><span className="stat-v">{stats.total}</span><span className="lbl">{p.workouts}</span></div>
        <div className="stat"><span className="stat-v">{stats.year}</span><span className="lbl">{p.thisYear}</span></div>
        <div className="stat"><span className="stat-v">{stats.streak}<span className="u">{p.weekUnit(stats.streak)}</span></span><span className="lbl">{p.streak}</span></div>
      </div>

      {account && <StravaCard />}

      <AccountSection />

      {section(p.training, <>
        {pick(p.weeklyGoal, s.weeklyGoal, "goal")}
        {pick(p.weekStartsOn, s.weekStart === "monday" ? p.monday : p.sunday, "weekStart")}
        {pick(p.defaultSets, s.defaultSets, "defaultSets")}
        {pick(p.weightStep, stepLabel(s.weightStepKg), "step")}
        {toggle(p.warmupsInPrs, s.warmupsInPrs, (v) => set({ warmupsInPrs: v }))}
      </>)}

      {section(p.workoutScreen, <>
        {toggle(p.restTimer, s.restTimerEnabled, (v) => set({ restTimerEnabled: v }))}
        {s.restTimerEnabled && pick(p.restTime, formatClock(s.restSeconds), "rest")}
        {s.restTimerEnabled && toggle(p.autoStart, s.restAutostart, (v) => set({ restAutostart: v }), s.restAutostart ? undefined : p.autoStartOff)}
        {toggle(p.keepScreenOn, device.keepScreenOn, (v) => void updateDeviceSettings({ keepScreenOn: v }))}
        {canHaptic() && toggle(p.vibrate, device.vibrateOnComplete, (v) => void updateDeviceSettings({ vibrateOnComplete: v }))}
      </>)}

      {section(p.appearance, <>
        {pick(p.theme, p.themes[s.theme], "theme")}
        <div className="row-stack">
          <span>{p.accent}</span>
          <span className="swatches" role="group" aria-label={p.accent}>
            {ACCENT_KEYS.map((k) => (
              <button key={k} type="button" className="swatch" style={{ ["--c" as string]: ACCENTS[k].c }} aria-label={p.accents[k]} aria-pressed={s.accent === k} onClick={() => set({ accent: k })}>
                <IconCheck />
              </button>
            ))}
          </span>
        </div>
        {seg(p.textSize, device.textSize, [["standard", p.standard], ["large", p.large]], (v) => void updateDeviceSettings({ textSize: v }))}
        {seg(p.navLabels, s.navLabels, [["always", p.always], ["active", p.active]], (v) => set({ navLabels: v }))}
        {seg(p.historyCards, s.historyCardStyle, [["names", p.names], ["detailed", p.detailed]], (v) => set({ historyCardStyle: v }))}
      </>)}

      {section(p.formats, <>
        {/* Each language is named in itself, so it can be found whatever the current language is. */}
        {seg<Language>(p.language, s.language, [["en", "English"], ["de", "Deutsch"]], (v) => set({ language: v }))}
        {seg(p.weightUnit, s.weightUnit, [["kg", "kg"], ["lb", "lb"]], (v) => set({ weightUnit: v }))}
        {seg(p.decimal, s.decimalSeparator, [["point", "82.5"], ["comma", "82,5"]], (v) => set({ decimalSeparator: v }))}
        {pick(p.dateFormat, s.dateFormat === "long" ? p.dateLongShort : "29.09.2026", "date")}
        <div className="example">{p.example} <b className="nw">{fmt.weight(82.5)}</b> · <b>{fmt.date(exampleDate)}</b></div>
      </>)}

      {section(p.home, <>
        {seg(p.startScreen, s.startScreen, [["home", p.startHome], ["workout", p.startWorkout]], (v) => set({ startScreen: v }))}
        {toggle(p.showGoal, s.homeShowGoal, (v) => set({ homeShowGoal: v }))}
        {toggle(p.showRoutines, s.homeShowRoutines, (v) => set({ homeShowRoutines: v }))}
        {toggle(p.showRecent, s.homeShowRecent, (v) => set({ homeShowRecent: v }))}
        {toggle(p.showPrs, s.homeShowPrs, (v) => set({ homeShowPrs: v }))}
        {toggle(p.showNutrition, s.homeShowNutrition, (v) => set({ homeShowNutrition: v }))}
      </>)}

      {section(p.data, <>
        <button type="button" className="row" onClick={() => void doExport()}><span>{p.exportBackup}</span><span className="val"><IconChevron /></span></button>
        <button type="button" className="row" onClick={() => fileRef.current?.click()}><span>{p.importBackup}</span><span className="val"><IconChevron /></span></button>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
      </>)}

      {section(p.about, <>
        <div className="row"><span>{p.version}</span><span className="val">{__APP_VERSION__}</span></div>
        <a className="row" href="https://github.com/yuhonas/free-exercise-db" target="_blank" rel="noopener noreferrer"><span>{p.exerciseData}</span><span className="val">free-exercise-db <IconExternal /></span></a>
      </>)}

      {rename && <TextSheet title={p.yourName} initial={s.displayName} maxLength={30} onSave={(v) => set({ displayName: v })} onClose={() => setRename(false)} />}
      {picker === "goal" && <RadioSheet title={p.weeklyGoal} sub={p.workoutsPerWeek} value={s.weeklyGoal} options={[1, 2, 3, 4, 5, 6, 7].map((n) => [n, String(n)] as [number, string])} onChange={(v) => set({ weeklyGoal: v })} onClose={() => setPicker(null)} />}
      {picker === "weekStart" && <RadioSheet title={p.weekStartsOn} value={s.weekStart} options={[["monday", p.monday], ["sunday", p.sunday]]} onChange={(v) => set({ weekStart: v })} onClose={() => setPicker(null)} />}
      {picker === "defaultSets" && <RadioSheet title={p.defaultSets} sub={p.defaultSetsSub} value={s.defaultSets} options={[1, 2, 3, 4, 5].map((n) => [n, String(n)] as [number, string])} onChange={(v) => set({ defaultSets: v })} onClose={() => setPicker(null)} />}
      {picker === "step" && <RadioSheet title={p.weightStep} sub={p.weightStepSub} value={s.weightStepKg as number} options={WEIGHT_STEPS_KG.map((k) => [k, stepLabel(k)] as [number, string])} onChange={(v) => set({ weightStepKg: v as UserSettings["weightStepKg"] })} onClose={() => setPicker(null)} />}
      {picker === "rest" && <RadioSheet title={p.restTime} value={s.restSeconds} options={[30, 45, 60, 75, 90, 105, 120, 150, 180, 240, 300].map((n) => [n, formatClock(n)] as [number, string])} onChange={(v) => set({ restSeconds: v })} onClose={() => setPicker(null)} />}
      {picker === "theme" && <RadioSheet title={p.theme} value={s.theme} options={[["system", p.themes.system], ["dark", p.themes.dark], ["light", p.themes.light]]} onChange={(v) => set({ theme: v })} onClose={() => setPicker(null)} />}
      {picker === "date" && <RadioSheet title={p.dateFormat} value={s.dateFormat} options={[["long", p.dateLong], ["numeric", "29.09.2026"]]} onChange={(v) => set({ dateFormat: v })} onClose={() => setPicker(null)} />}
      {backup && (
        <Sheet onClose={() => setBackup(null)} label={p.importBackup}>
          <h3>{p.replaceTitle}</h3>
          <p>{p.backupFrom(fmt.date(backup.exportedAt), backup.workouts, backup.runs, backup.routines)}</p>
          <p>{p.replaceText}</p>
          <div className="acts">
            <button type="button" className="btn btn-primary btn-block" onClick={() => { const b = backup.backup; setBackup(null); void importBackup(b).then(() => toast(p.restored)); }}>{p.replace}</button>
            <button type="button" className="btn btn-block" onClick={() => setBackup(null)}>{t.common.cancel}</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
