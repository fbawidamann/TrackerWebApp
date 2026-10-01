import type { AdminUser } from "@fitness/shared";
import { useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError, NetworkError } from "@/api/client";
import { useAccount } from "@/data/hooks";
import { tr, useT } from "@/i18n";
import { useFormat } from "@/lib/useFormat";
import { IconBack, IconChevron, IconPlus } from "@/ui/icons";
import { generatePassword, PasswordField, PasswordRules, passwordValid } from "@/ui/Password";
import { ConfirmSheet, MenuSheet, Sheet } from "@/ui/Sheet";
import { useToast } from "@/ui/Toast";

type SheetState = { kind: "create" } | { kind: "menu" | "reset" | "disable" | "delete"; user: AdminUser } | null;
const errText = (e: unknown) => (e instanceof NetworkError ? tr().admin.noConnection : e instanceof ApiError ? e.message : tr().admin.failed);

/** Users (admin only): docs/design/screens/admin-users.md. Needs a connection (it's server data). */
export function UsersScreen() {
  const router = useRouter();
  const account = useAccount();
  const toast = useToast();
  const fmt = useFormat();
  const t = useT();
  const a = t.admin;
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState("");
  const [sheet, setSheet] = useState<SheetState>(null);

  const load = useCallback(async () => {
    try { setUsers(await api<AdminUser[]>("GET", "/api/admin/users")); setError(""); } catch (e) { setError(errText(e)); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (account && account.role !== "admin") return <div className="page"><p className="muted">{a.adminsOnly}</p></div>;
  const relSync = (iso: string) => a.lastSync(fmt.relDay(new Date(iso)));
  const run = async (fn: () => Promise<unknown>, done: string) => {
    try { await fn(); toast(done); await load(); } catch (e) { toast(errText(e)); }
  };

  return (
    <div className="page tight">
      <div className="topbar">
        <button type="button" className="ib" onClick={() => router.history.back()} aria-label={t.common.back}><IconBack /></button>
        <span className="t">{a.users}</span>
        <button type="button" className="ib" onClick={() => setSheet({ kind: "create" })} aria-label={a.createUser}><IconPlus /></button>
      </div>
      {error && <div className="card empty"><p>{error}</p><button type="button" className="ghost" onClick={() => void load()}>{a.tryAgain}</button></div>}
      {users && (
        <div className="card list">
          {users.map((u) => {
            const me = u.id === account?.userId;
            const meta = (u.lastSyncAt ? relSync(u.lastSyncAt) : u.lastLoginAt ? a.notSynced : a.neverLoggedIn) + (u.workouts ? ` · ${t.common.workouts(u.workouts)}` : "");
            return (
              <button key={u.id} type="button" className={"li" + (u.disabled ? " disabled" : "")} disabled={me} onClick={() => setSheet({ kind: "menu", user: u })}>
                <span className="li-main">
                  <span className="li-name" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <span>{u.username}</span>
                    {u.role === "admin" && <span className="tag acc">{a.admin}</span>}
                    {u.disabled && <span className="tag">{a.disabled}</span>}
                  </span>
                  <span className="li-meta">{meta}</span>
                </span>
                {!me && <span className="li-side"><IconChevron /></span>}
              </button>
            );
          })}
        </div>
      )}
      <p className="hint">{a.onlyYou}</p>

      {sheet?.kind === "create" && <CreateUserSheet existing={users ?? []} onClose={() => setSheet(null)} onCreated={(name) => { setSheet(null); toast(a.created(name)); void load(); }} />}
      {sheet?.kind === "menu" && (
        <MenuSheet title={sheet.user.username} onClose={() => setSheet(null)} items={[
          { label: a.resetPassword, onSelect: () => setSheet({ kind: "reset", user: sheet.user }) },
          sheet.user.disabled
            ? { label: a.enable, onSelect: () => void run(() => api("PATCH", `/api/admin/users/${sheet.user.id}`, { disabled: false }), a.enabled(sheet.user.username)) }
            : { label: a.disable, onSelect: () => setSheet({ kind: "disable", user: sheet.user }) },
          { label: a.deleteUser, danger: true, onSelect: () => setSheet({ kind: "delete", user: sheet.user }) },
        ]} />
      )}
      {sheet?.kind === "reset" && <ResetPasswordSheet user={sheet.user} onClose={() => setSheet(null)} onDone={() => { setSheet(null); toast(a.passwordChanged(sheet.user.username)); }} />}
      {sheet?.kind === "disable" && (
        <ConfirmSheet title={a.disableTitle(sheet.user.username)} text={a.disableText(sheet.user.username)} confirm={a.disable} danger
          onClose={() => setSheet(null)} onConfirm={() => void run(() => api("PATCH", `/api/admin/users/${sheet.user.id}`, { disabled: true }), a.disabledToast(sheet.user.username))} />
      )}
      {sheet?.kind === "delete" && (
        <ConfirmSheet title={a.deleteTitle(sheet.user.username)} text={a.deleteText(sheet.user.username)} confirm={a.deleteUser} danger
          onClose={() => setSheet(null)} onConfirm={() => void run(() => api("DELETE", `/api/admin/users/${sheet.user.id}`, {}), a.deleted(sheet.user.username))} />
      )}
    </div>
  );
}

function CreateUserSheet({ existing, onClose, onCreated }: { existing: AdminUser[]; onClose: () => void; onCreated: (name: string) => void }) {
  const t = useT();
  const a = t.admin;
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const trimmed = name.trim();
  const taken = existing.some((u) => u.username.toLowerCase() === trimmed.toLowerCase());
  const nameOk = /^[A-Za-z0-9_.-]{3,30}$/.test(trimmed);
  const create = async () => {
    setError("");
    try { await api("POST", "/api/admin/users", { username: trimmed, password: pw }); onCreated(trimmed); } catch (e) { setError(errText(e)); }
  };
  return (
    <Sheet onClose={onClose} label={a.createUser}>
      <h3>{a.createUser}</h3>
      <div className="grp" style={{ gap: 8 }}>
        <label className="lbl" htmlFor="cu-name">{t.auth.username}</label>
        <input id="cu-name" className="field" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder={a.usernamePlaceholder} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        {taken && <p className="err">{a.taken}</p>}
        {!taken && name && !nameOk && <p className="hint">{a.usernameRule}</p>}
      </div>
      <div className="grp" style={{ gap: 8 }}>
        <PasswordField id="cu-pw" label={t.auth.password} value={pw} onChange={setPw} show={show} onToggle={() => setShow(!show)} autoComplete="new-password" />
        <PasswordRules value={pw} />
        <button type="button" className="gen" onClick={() => { setPw(generatePassword()); setShow(true); }}>{a.generate}</button>
      </div>
      {error && <p className="err" role="alert">{error}</p>}
      <div className="acts"><button type="button" className="btn btn-primary btn-block" disabled={!nameOk || taken || !passwordValid(pw)} onClick={() => void create()}>{a.create}</button></div>
    </Sheet>
  );
}

function ResetPasswordSheet({ user, onClose, onDone }: { user: AdminUser; onClose: () => void; onDone: () => void }) {
  const t = useT();
  const a = t.admin;
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setError("");
    try { await api("PATCH", `/api/admin/users/${user.id}`, { password: pw }); onDone(); } catch (e) { setError(errText(e)); }
  };
  return (
    <Sheet onClose={onClose} label={a.resetPassword}>
      <h3>{a.newPasswordFor(user.username)}</h3>
      <div className="grp" style={{ gap: 8 }}>
        <PasswordField id="rp-pw" label={a.newPassword} value={pw} onChange={setPw} show={show} onToggle={() => setShow(!show)} autoComplete="new-password" autoFocus />
        <PasswordRules value={pw} />
        <button type="button" className="gen" onClick={() => { setPw(generatePassword()); setShow(true); }}>{a.generate}</button>
      </div>
      <p>{a.mustLogInAgain(user.username)}</p>
      {error && <p className="err" role="alert">{error}</p>}
      <div className="acts"><button type="button" className="btn btn-primary btn-block" disabled={!passwordValid(pw)} onClick={() => void save()}>{t.common.save}</button></div>
    </Sheet>
  );
}
