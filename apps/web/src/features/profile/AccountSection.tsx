import { formatTime } from "@fitness/shared";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { api, ApiError, NetworkError } from "@/api/client";
import { useAccount, useSyncStatus } from "@/data/hooks";
import { logout, prepareLogout } from "@/sync/account";
import { syncNow } from "@/sync/engine";
import { useNow } from "@/lib/time";
import { BusyOverlay } from "@/ui/Brand";
import { IconChevron } from "@/ui/icons";
import { PasswordField, PasswordRules, passwordValid } from "@/ui/Password";
import { Sheet } from "@/ui/Sheet";
import { useToast } from "@/ui/Toast";

/** Profile → Account (docs/design/screens/login.md): name, sync status, Sync now, Change password, Users (admin), Log out. */
export function AccountSection() {
  const account = useAccount();
  const status = useSyncStatus();
  const now = useNow(30_000);
  const navigate = useNavigate();
  const toast = useToast();
  const [pwSheet, setPwSheet] = useState(false);
  const [logoutSheet, setLogoutSheet] = useState<{ pending: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  if (!account) return null;

  const statusLine = (() => {
    if (status.state === "syncing") return <><span className="sdot" />Syncing…</>;
    if (status.error === "offline" || !navigator.onLine) {
      return <><span className={"sdot" + (status.pending ? " warn" : "")} />{status.pending ? `Offline · ${status.pending} ${status.pending === 1 ? "change" : "changes"} waiting` : "Offline"}</>;
    }
    if (status.error === "failed") return <><span className="sdot warn" />Sync failed · <button type="button" className="retry" onClick={() => void syncNow()}>Try again</button></>;
    if (!status.lastSyncAt) return <><span className="sdot" />Not synced yet</>;
    const d = new Date(status.lastSyncAt);
    const mins = Math.floor((now - d.getTime()) / 60_000);
    const today = new Date(now).toDateString() === d.toDateString();
    const yesterday = new Date(now - 86_400_000).toDateString() === d.toDateString();
    const text = mins < 1 ? "just now" : mins < 60 ? `${mins} min ago` : today ? `today, ${formatTime(d)}` : yesterday ? `yesterday, ${formatTime(d)}` : d.toLocaleDateString("en-GB");
    return <><span className="sdot ok" />Synced {text}</>;
  })();

  const startLogout = async () => {
    setBusy("Syncing…");
    const pending = await prepareLogout();
    setBusy(null);
    setLogoutSheet({ pending });
  };
  const doLogout = async () => {
    setLogoutSheet(null);
    setBusy("Logging out…");
    await logout();
    setBusy(null);
    void navigate({ to: "/" });
  };

  return (
    <div className="sec" style={{ gap: 10 }}>
      <span className="lbl">Account</span>
      <div className="card rows">
        <div className="acct">
          <span className="name"><span>{account.username}</span>{account.role === "admin" && <span className="tag acc">Admin</span>}</span>
          <span className="status-line">{statusLine}</span>
        </div>
        <button type="button" className="row" disabled={status.state === "syncing"} onClick={() => {
          if (!navigator.onLine) { toast(status.pending ? `No connection. ${status.pending} changes wait until you're online.` : "No connection."); return; }
          void syncNow();
        }}><span>Sync now</span></button>
        <button type="button" className="row" onClick={() => setPwSheet(true)}><span>Change password</span><span className="val"><IconChevron /></span></button>
        {account.role === "admin" && (
          <button type="button" className="row" onClick={() => void navigate({ to: "/profile/users" })}><span>Users</span><span className="val"><IconChevron /></span></button>
        )}
        <button type="button" className="row danger" onClick={() => void startLogout()}><span>Log out</span></button>
      </div>

      {pwSheet && <ChangePasswordSheet onClose={() => setPwSheet(false)} onDone={() => { setPwSheet(false); toast("Password changed"); }} />}
      {logoutSheet && (
        <Sheet onClose={() => setLogoutSheet(null)} label="Log out">
          {logoutSheet.pending ? (
            <>
              <h3>{logoutSheet.pending} {logoutSheet.pending === 1 ? "change isn't" : "changes aren't"} uploaded yet</h3>
              <p>Without a connection they will be lost if you log out now.</p>
              <div className="acts">
                <button type="button" className="btn btn-block btn-danger" onClick={() => void doLogout()}>Log out anyway</button>
                <button type="button" className="btn btn-block" onClick={() => setLogoutSheet(null)}>Cancel</button>
              </div>
            </>
          ) : (
            <>
              <h3>Log out?</h3>
              <p>Your data stays on the server and is removed from this device.</p>
              <div className="acts">
                <button type="button" className="btn btn-block btn-primary" onClick={() => void doLogout()}>Log out</button>
                <button type="button" className="btn btn-block" onClick={() => setLogoutSheet(null)}>Cancel</button>
              </div>
            </>
          )}
        </Sheet>
      )}
      {busy && <BusyOverlay title={busy} />}
    </div>
  );
}

function ChangePasswordSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const ok = !!cur && passwordValid(pw) && pw === pw2;
  const save = async () => {
    setSaving(true); setError("");
    try {
      await api("POST", "/api/auth/password", { currentPassword: cur, newPassword: pw });
      onDone();
    } catch (e) {
      setError(e instanceof NetworkError ? "No connection." : e instanceof ApiError ? e.message : "Something went wrong.");
    } finally { setSaving(false); }
  };
  return (
    <Sheet onClose={onClose} label="Change password">
      <h3>Change password</h3>
      <PasswordField id="cp-cur" label="Current password" value={cur} onChange={setCur} show={show} onToggle={() => setShow(!show)} autoComplete="current-password" autoFocus />
      <div className="grp" style={{ gap: 8 }}>
        <PasswordField id="cp-new" label="New password" value={pw} onChange={setPw} show={show} onToggle={() => setShow(!show)} autoComplete="new-password" />
        <PasswordRules value={pw} />
      </div>
      <PasswordField id="cp-new2" label="Repeat new password" value={pw2} onChange={setPw2} show={show} onToggle={() => setShow(!show)} autoComplete="new-password" />
      {pw2 && pw !== pw2 && <p className="err">The passwords don't match</p>}
      {error && <p className="err" role="alert">{error}</p>}
      <div className="acts"><button type="button" className="btn btn-primary btn-block" disabled={!ok || saving} onClick={() => void save()}>Save</button></div>
    </Sheet>
  );
}
