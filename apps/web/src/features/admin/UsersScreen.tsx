import type { AdminUser } from "@fitness/shared";
import { useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError, NetworkError } from "@/api/client";
import { useAccount } from "@/data/hooks";
import { useFormat } from "@/lib/useFormat";
import { IconBack, IconChevron, IconPlus } from "@/ui/icons";
import { generatePassword, PasswordField, PasswordRules, passwordValid } from "@/ui/Password";
import { ConfirmSheet, MenuSheet, Sheet } from "@/ui/Sheet";
import { useToast } from "@/ui/Toast";

type SheetState = { kind: "create" } | { kind: "menu" | "reset" | "disable" | "delete"; user: AdminUser } | null;
const errText = (e: unknown) => (e instanceof NetworkError ? "No connection. User management needs the internet." : e instanceof ApiError ? e.message : "Something went wrong.");

/** Users (admin only): docs/design/screens/admin-users.md. Needs a connection (it's server data). */
export function UsersScreen() {
  const router = useRouter();
  const account = useAccount();
  const toast = useToast();
  const fmt = useFormat();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState("");
  const [sheet, setSheet] = useState<SheetState>(null);

  const load = useCallback(async () => {
    try { setUsers(await api<AdminUser[]>("GET", "/api/admin/users")); setError(""); } catch (e) { setError(errText(e)); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (account && account.role !== "admin") return <div className="page"><p className="muted">Admins only.</p></div>;
  const relSync = (iso: string) => { const d = fmt.relDay(new Date(iso)); return "Last sync " + (d === "Today" || d === "Yesterday" ? d.toLowerCase() : d); };
  const run = async (fn: () => Promise<unknown>, done: string) => {
    try { await fn(); toast(done); await load(); } catch (e) { toast(errText(e)); }
  };

  return (
    <div className="page tight">
      <div className="topbar">
        <button type="button" className="ib" onClick={() => router.history.back()} aria-label="Back"><IconBack /></button>
        <span className="t">Users</span>
        <button type="button" className="ib" onClick={() => setSheet({ kind: "create" })} aria-label="Create user"><IconPlus /></button>
      </div>
      {error && <div className="card empty"><p>{error}</p><button type="button" className="ghost" onClick={() => void load()}>Try again</button></div>}
      {users && (
        <div className="card list">
          {users.map((u) => {
            const me = u.id === account?.userId;
            const meta = (u.lastSyncAt ? relSync(u.lastSyncAt) : u.lastLoginAt ? "Logged in, not synced yet" : "Never logged in") + (u.workouts ? ` · ${u.workouts} ${u.workouts === 1 ? "workout" : "workouts"}` : "");
            return (
              <button key={u.id} type="button" className={"li" + (u.disabled ? " disabled" : "")} disabled={me} onClick={() => setSheet({ kind: "menu", user: u })}>
                <span className="li-main">
                  <span className="li-name" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <span>{u.username}</span>
                    {u.role === "admin" && <span className="tag acc">Admin</span>}
                    {u.disabled && <span className="tag">Disabled</span>}
                  </span>
                  <span className="li-meta">{meta}</span>
                </span>
                {!me && <span className="li-side"><IconChevron /></span>}
              </button>
            );
          })}
        </div>
      )}
      <p className="hint">Only you (admin) can create accounts. Nobody can register.</p>

      {sheet?.kind === "create" && <CreateUserSheet existing={users ?? []} onClose={() => setSheet(null)} onCreated={(name) => { setSheet(null); toast(`${name} created`); void load(); }} />}
      {sheet?.kind === "menu" && (
        <MenuSheet title={sheet.user.username} onClose={() => setSheet(null)} items={[
          { label: "Reset password", onSelect: () => setSheet({ kind: "reset", user: sheet.user }) },
          sheet.user.disabled
            ? { label: "Enable", onSelect: () => void run(() => api("PATCH", `/api/admin/users/${sheet.user.id}`, { disabled: false }), `${sheet.user.username} enabled`) }
            : { label: "Disable", onSelect: () => setSheet({ kind: "disable", user: sheet.user }) },
          { label: "Delete user", danger: true, onSelect: () => setSheet({ kind: "delete", user: sheet.user }) },
        ]} />
      )}
      {sheet?.kind === "reset" && <ResetPasswordSheet user={sheet.user} onClose={() => setSheet(null)} onDone={() => { setSheet(null); toast(`Password changed · ${sheet.user.username} has to log in again`); }} />}
      {sheet?.kind === "disable" && (
        <ConfirmSheet title={`Disable ${sheet.user.username}?`} text={`${sheet.user.username} can't log in until enabled again. Data stays.`} confirm="Disable" danger
          onClose={() => setSheet(null)} onConfirm={() => void run(() => api("PATCH", `/api/admin/users/${sheet.user.id}`, { disabled: true }), `${sheet.user.username} disabled`)} />
      )}
      {sheet?.kind === "delete" && (
        <ConfirmSheet title={`Delete ${sheet.user.username}?`} text={`All of ${sheet.user.username}'s workouts, routines and settings are deleted from the server. This can't be undone.`} confirm="Delete user" danger
          onClose={() => setSheet(null)} onConfirm={() => void run(() => api("DELETE", `/api/admin/users/${sheet.user.id}`, {}), `${sheet.user.username} deleted`)} />
      )}
    </div>
  );
}

function CreateUserSheet({ existing, onClose, onCreated }: { existing: AdminUser[]; onClose: () => void; onCreated: (name: string) => void }) {
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
    <Sheet onClose={onClose} label="Create user">
      <h3>Create user</h3>
      <div className="grp" style={{ gap: 8 }}>
        <label className="lbl" htmlFor="cu-name">Username</label>
        <input id="cu-name" className="field" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="e.g. Anna" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        {taken && <p className="err">This username is taken</p>}
        {!taken && name && !nameOk && <p className="hint">3–30 characters: letters, numbers, _ . -</p>}
      </div>
      <div className="grp" style={{ gap: 8 }}>
        <PasswordField id="cu-pw" label="Password" value={pw} onChange={setPw} show={show} onToggle={() => setShow(!show)} autoComplete="new-password" />
        <PasswordRules value={pw} />
        <button type="button" className="gen" onClick={() => { setPw(generatePassword()); setShow(true); }}>Generate password</button>
      </div>
      {error && <p className="err" role="alert">{error}</p>}
      <div className="acts"><button type="button" className="btn btn-primary btn-block" disabled={!nameOk || taken || !passwordValid(pw)} onClick={() => void create()}>Create</button></div>
    </Sheet>
  );
}

function ResetPasswordSheet({ user, onClose, onDone }: { user: AdminUser; onClose: () => void; onDone: () => void }) {
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setError("");
    try { await api("PATCH", `/api/admin/users/${user.id}`, { password: pw }); onDone(); } catch (e) { setError(errText(e)); }
  };
  return (
    <Sheet onClose={onClose} label="Reset password">
      <h3>New password for {user.username}</h3>
      <div className="grp" style={{ gap: 8 }}>
        <PasswordField id="rp-pw" label="New password" value={pw} onChange={setPw} show={show} onToggle={() => setShow(!show)} autoComplete="new-password" autoFocus />
        <PasswordRules value={pw} />
        <button type="button" className="gen" onClick={() => { setPw(generatePassword()); setShow(true); }}>Generate password</button>
      </div>
      <p>{user.username} has to log in again with the new password.</p>
      {error && <p className="err" role="alert">{error}</p>}
      <div className="acts"><button type="button" className="btn btn-primary btn-block" disabled={!passwordValid(pw)} onClick={() => void save()}>Save</button></div>
    </Sheet>
  );
}
