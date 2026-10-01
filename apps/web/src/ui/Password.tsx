import { passwordRules } from "@fitness/shared";
import { useT } from "@/i18n";
import { IconCheck, IconEye, IconEyeOff } from "./icons";

/** Password input with a show/hide eye button. */
export function PasswordField(props: {
  id: string; label: string; value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void;
  autoComplete: "current-password" | "new-password"; autoFocus?: boolean;
}) {
  const { id, label, value, onChange, show, onToggle, autoComplete, autoFocus } = props;
  const t = useT();
  return (
    <div className="grp" style={{ gap: 8 }}>
      <label className="lbl" htmlFor={id}>{label}</label>
      <div className="field-wrap">
        <input id={id} className="field pw" type={show ? "text" : "password"} autoComplete={autoComplete} autoCapitalize="none" spellCheck={false}
          value={value} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus} />
        <button type="button" className="ib eye" onClick={onToggle} aria-label={show ? t.ui.hidePassword : t.ui.showPassword}>{show ? <IconEyeOff /> : <IconEye />}</button>
      </div>
    </div>
  );
}

/** Live checklist: 8+ characters · a number · a special character. */
export function PasswordRules({ value }: { value: string }) {
  const t = useT();
  const r = passwordRules(value);
  const items: Array<[boolean, string]> = [[r.length, t.ui.ruleLength], [r.number, t.ui.ruleNumber], [r.special, t.ui.ruleSpecial]];
  return (
    <ul className="pw-rules" aria-label={t.ui.passwordRules}>
      {items.map(([ok, label]) => <li key={label} className={ok ? "ok" : undefined}><IconCheck />{label}</li>)}
    </ul>
  );
}

export const passwordValid = (pw: string): boolean => { const r = passwordRules(pw); return r.length && r.number && r.special; };

/** Strong random password (12 characters, with a number and a special character) that's easy to pass on. */
export function generatePassword(): string {
  const letters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ", digits = "23456789", special = "!#$%&*+?@";
  const pick = (set: string) => set[crypto.getRandomValues(new Uint32Array(1))[0]! % set.length]!;
  const chars = [pick(digits), pick(special)];
  while (chars.length < 12) chars.push(pick(letters + digits));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0]! % (i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join("");
}
