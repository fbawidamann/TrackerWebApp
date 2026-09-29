import { ACCENTS as ACCENT_KEYS, formatClock, MONTHS, WEIGHT_STEPS_KG, weightStepInUnit, type UserSettings } from "@fitness/shared";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { ACCENTS } from "@/app/theme";
import { exportBackup, importBackup, parseBackup, updateDeviceSettings, updateSettings, type ParsedBackup } from "@/db/actions";
import { useDeviceSettings, useSettings, useTraining } from "@/data/hooks";
import { useFormat } from "@/lib/useFormat";
import { IconCheck, IconChevron, IconExternal, IconPhone } from "@/ui/icons";
import { RadioSheet, Sheet, TextSheet } from "@/ui/Sheet";
import { useToast } from "@/ui/Toast";

type Picker = "goal" | "weekStart" | "defaultSets" | "step" | "rest" | "theme" | "date" | null;

export function ProfileScreen() {
  const s = useSettings();
  const device = useDeviceSettings();
  const training = useTraining();
  const fmt = useFormat();
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
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: name }); toast("Backup saved"); return; }
    } catch { /* share cancelled: fall back to download */ }
    const url = URL.createObjectURL(file);
    const a = Object.assign(document.createElement("a"), { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Backup saved");
  };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const parsed = parseBackup(await f.text());
    if (parsed.ok) setBackup(parsed); else toast("This file isn't a valid backup");
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
        <button type="button" onClick={() => setRename(true)} aria-label="Change name" style={{ display: "block", textAlign: "left" }}>
          <h1 className="title" style={s.displayName ? undefined : { color: "var(--muted)" }}>{s.displayName || "Your name"}</h1>
        </button>
        {stats.first && <p className="sub">Training since {MONTHS[stats.first.getMonth()]} {stats.first.getFullYear()}</p>}
      </div>
      <div className="card stats eq">
        <div className="stat"><span className="stat-v">{stats.total}</span><span className="lbl">Workouts</span></div>
        <div className="stat"><span className="stat-v">{stats.year}</span><span className="lbl">This year</span></div>
        <div className="stat"><span className="stat-v">{stats.streak}<span className="u">{stats.streak === 1 ? "week" : "weeks"}</span></span><span className="lbl">Streak</span></div>
      </div>

      <div className="sec">
        <span className="lbl">Account</span>
        <div className="card info"><IconPhone /><span><span style={{ display: "block", fontWeight: 500 }}>Saved on this device</span><span className="row-sub">Back up with Export backup</span></span></div>
      </div>

      {section("Training", <>
        {pick("Weekly goal", s.weeklyGoal, "goal")}
        {pick("Week starts on", s.weekStart === "monday" ? "Monday" : "Sunday", "weekStart")}
        {pick("Default sets", s.defaultSets, "defaultSets")}
        {pick("Weight step", stepLabel(s.weightStepKg), "step")}
        {toggle("Warm-ups in PRs & charts", s.warmupsInPrs, (v) => set({ warmupsInPrs: v }))}
      </>)}

      {section("Workout screen", <>
        {toggle("Rest timer", s.restTimerEnabled, (v) => set({ restTimerEnabled: v }))}
        {s.restTimerEnabled && pick("Rest time", formatClock(s.restSeconds), "rest")}
        {s.restTimerEnabled && toggle("Start automatically", s.restAutostart, (v) => set({ restAutostart: v }), s.restAutostart ? undefined : "Start it from the set row")}
        {toggle("Keep screen on", device.keepScreenOn, (v) => void updateDeviceSettings({ keepScreenOn: v }))}
        {"vibrate" in navigator && toggle("Vibrate on set complete", device.vibrateOnComplete, (v) => void updateDeviceSettings({ vibrateOnComplete: v }))}
      </>)}

      {section("Appearance", <>
        {pick("Theme", { system: "System", dark: "Dark", light: "Light" }[s.theme], "theme")}
        <div className="row-stack">
          <span>Accent colour</span>
          <span className="swatches" role="group" aria-label="Accent colour">
            {ACCENT_KEYS.map((k) => (
              <button key={k} type="button" className="swatch" style={{ ["--c" as string]: ACCENTS[k].c }} aria-label={ACCENTS[k].name} aria-pressed={s.accent === k} onClick={() => set({ accent: k })}>
                <IconCheck />
              </button>
            ))}
          </span>
        </div>
        {seg("Text size", device.textSize, [["standard", "Standard"], ["large", "Large"]], (v) => void updateDeviceSettings({ textSize: v }))}
        {seg("Nav labels", s.navLabels, [["always", "Always"], ["active", "Active"]], (v) => set({ navLabels: v }))}
        {seg("History cards", s.historyCardStyle, [["names", "Names"], ["detailed", "Detailed"]], (v) => set({ historyCardStyle: v }))}
      </>)}

      {section("Units and formats", <>
        {seg("Weight unit", s.weightUnit, [["kg", "kg"], ["lb", "lb"]], (v) => set({ weightUnit: v }))}
        {seg("Decimal", s.decimalSeparator, [["point", "82.5"], ["comma", "82,5"]], (v) => set({ decimalSeparator: v }))}
        {pick("Date format", s.dateFormat === "long" ? "Tue, 29 Sep" : "29.09.2026", "date")}
        <div className="example">Example: <b className="nw">{fmt.weight(82.5)}</b> · <b>{fmt.date(exampleDate)}</b></div>
      </>)}

      {section("Home", <>
        {seg("Start screen", s.startScreen, [["home", "Home"], ["workout", "Workout"]], (v) => set({ startScreen: v }))}
        {toggle("Weekly goal", s.homeShowGoal, (v) => set({ homeShowGoal: v }))}
        {toggle("Routines", s.homeShowRoutines, (v) => set({ homeShowRoutines: v }))}
        {toggle("Recent workouts", s.homeShowRecent, (v) => set({ homeShowRecent: v }))}
        {toggle("Latest PRs", s.homeShowPrs, (v) => set({ homeShowPrs: v }))}
      </>)}

      {section("Data", <>
        <button type="button" className="row" onClick={() => void doExport()}><span>Export backup</span><span className="val"><IconChevron /></span></button>
        <button type="button" className="row" onClick={() => fileRef.current?.click()}><span>Import backup</span><span className="val"><IconChevron /></span></button>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
      </>)}

      {section("About", <>
        <div className="row"><span>Version</span><span className="val">{__APP_VERSION__}</span></div>
        <a className="row" href="https://github.com/yuhonas/free-exercise-db" target="_blank" rel="noopener noreferrer"><span>Exercise data</span><span className="val">free-exercise-db <IconExternal /></span></a>
      </>)}

      {rename && <TextSheet title="Your name" initial={s.displayName} maxLength={30} onSave={(v) => set({ displayName: v })} onClose={() => setRename(false)} />}
      {picker === "goal" && <RadioSheet title="Weekly goal" sub="Workouts per week" value={s.weeklyGoal} options={[1, 2, 3, 4, 5, 6, 7].map((n) => [n, String(n)] as [number, string])} onChange={(v) => set({ weeklyGoal: v })} onClose={() => setPicker(null)} />}
      {picker === "weekStart" && <RadioSheet title="Week starts on" value={s.weekStart} options={[["monday", "Monday"], ["sunday", "Sunday"]]} onChange={(v) => set({ weekStart: v })} onClose={() => setPicker(null)} />}
      {picker === "defaultSets" && <RadioSheet title="Default sets" sub="For exercises added without history" value={s.defaultSets} options={[1, 2, 3, 4, 5].map((n) => [n, String(n)] as [number, string])} onChange={(v) => set({ defaultSets: v })} onClose={() => setPicker(null)} />}
      {picker === "step" && <RadioSheet title="Weight step" sub="Smallest plate increment" value={s.weightStepKg as number} options={WEIGHT_STEPS_KG.map((k) => [k, stepLabel(k)] as [number, string])} onChange={(v) => set({ weightStepKg: v as UserSettings["weightStepKg"] })} onClose={() => setPicker(null)} />}
      {picker === "rest" && <RadioSheet title="Rest time" value={s.restSeconds} options={[30, 45, 60, 75, 90, 105, 120, 150, 180, 240, 300].map((n) => [n, formatClock(n)] as [number, string])} onChange={(v) => set({ restSeconds: v })} onClose={() => setPicker(null)} />}
      {picker === "theme" && <RadioSheet title="Theme" value={s.theme} options={[["system", "System"], ["dark", "Dark"], ["light", "Light"]]} onChange={(v) => set({ theme: v })} onClose={() => setPicker(null)} />}
      {picker === "date" && <RadioSheet title="Date format" value={s.dateFormat} options={[["long", "Tuesday, 29 September"], ["numeric", "29.09.2026"]]} onChange={(v) => set({ dateFormat: v })} onClose={() => setPicker(null)} />}
      {backup && (
        <Sheet onClose={() => setBackup(null)} label="Import backup">
          <h3>Replace all data on this device?</h3>
          <p>Backup from {fmt.date(backup.exportedAt)} · {backup.workouts} workouts · {backup.routines} routines.</p>
          <p>Your current data will be replaced.</p>
          <div className="acts">
            <button type="button" className="btn btn-primary btn-block" onClick={() => { const b = backup.backup; setBackup(null); void importBackup(b).then(() => toast("Backup restored")); }}>Replace</button>
            <button type="button" className="btn btn-block" onClick={() => setBackup(null)}>Cancel</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
