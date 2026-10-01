import { formatTime } from "@fitness/shared";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { api, ApiError, NetworkError } from "@/api/client";
import { useAccount, useSyncStatus } from "@/data/hooks";
import { useT } from "@/i18n";
import { logout, prepareLogout } from "@/sync/account";
import { syncNow } from "@/sync/engine";
import { useFormat } from "@/lib/useFormat";
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
  const t = useT();
  const a = t.account;
  const fmt = useFormat();
  const [pwSheet, setPwSheet] = useState(false);
  const [logoutSheet, setLogoutSheet] = useState<{ pending: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  if (!account) return null;

  const statusLine = (() => {
    if (status.state === "syncing") return <><span className="sdot" />{a.syncing}</>;
    if (status.error === "offline" || !navigator.onLine) {
      return <><span className={"sdot" + (status.pending ? " warn" : "")} />{status.pending ? a.offlineWaiting(status.pending) : a.offline}</>;
    }
    if (status.error === "failed") return <><span className="sdot warn" />{a.syncFailed} · <button type="button" className="retry" onClick={() => void syncNow()}>{a.tryAgain}</button></>;
    if (!status.lastSyncAt) return <><span className="sdot" />{a.notSynced}</>;
    const d = new Date(status.lastSyncAt);
    const mins = Math.floor((now - d.getTime()) / 60_000);
    const today = new Date(now).toDateString() === d.toDateString();
    const yesterday = new Date(now - 86_400_000).toDateString() === d.toDateString();
    const text = mins < 1 ? a.justNow : mins < 60 ? a.minAgo(mins) : today ? a.todayAt(formatTime(d)) : yesterday ? a.yesterdayAt(formatTime(d)) : fmt.shortDate(d);
    return <><span className="sdot ok" />{a.synced(text)}</>;
  })();

  const startLogout = async () => {
    setBusy(a.syncing);
    const pending = await prepareLogout();
    setBusy(null);
    setLogoutSheet({ pending });
  };
  const doLogout = async () => {
    setLogoutSheet(null);
    setBusy(a.loggingOut);
    await logout();
    setBusy(null);
    void navigate({ to: "/" });
  };

  return (
    <div className="sec" style={{ gap: 10 }}>
      <span className="lbl">{a.account}</span>
      <div className="card rows">
        <div className="acct">
          <span className="name"><span>{account.username}</span>{account.role === "admin" && <span className="tag acc">{a.admin}</span>}</span>
          <span className="status-line">{statusLine}</span>
        </div>
        <button type="button" className="row" disabled={status.state === "syncing"} onClick={() => {
          if (!navigator.onLine) { toast(status.pending ? a.noConnectionPending(status.pending) : a.noConnection); return; }
          void syncNow();
        }}><span>{a.syncNow}</span></button>
        <button type="button" className="row" onClick={() => setPwSheet(true)}><span>{a.changePassword}</span><span className="val"><IconChevron /></span></button>
        {account.role === "admin" && (
          <button type="button" className="row" onClick={() => void navigate({ to: "/profile/users" })}><span>{a.users}</span><span className="val"><IconChevron /></span></button>
        )}
        <button type="button" className="row danger" onClick={() => void startLogout()}><span>{a.logOut}</span></button>
      </div>

      {pwSheet && <ChangePasswordSheet onClose={() => setPwSheet(false)} onDone={() => { setPwSheet(false); toast(a.passwordChanged); }} />}
      {logoutSheet && (
        <Sheet onClose={() => setLogoutSheet(null)} label={a.logOut}>
          {logoutSheet.pending ? (
            <>
              <h3>{a.notUploaded(logoutSheet.pending)}</h3>
              <p>{a.lostWarning}</p>
              <div className="acts">
                <button type="button" className="btn btn-block btn-danger" onClick={() => void doLogout()}>{a.logOutAnyway}</button>
                <button type="button" className="btn btn-block" onClick={() => setLogoutSheet(null)}>{t.common.cancel}</button>
              </div>
            </>
          ) : (
            <>
              <h3>{a.logOutTitle}</h3>
              <p>{a.logOutText}</p>
              <div className="acts">
                <button type="button" className="btn btn-block btn-primary" onClick={() => void doLogout()}>{a.logOut}</button>
                <button type="button" className="btn btn-block" onClick={() => setLogoutSheet(null)}>{t.common.cancel}</button>
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
  const t = useT();
  const a = t.account;
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
      setError(e instanceof NetworkError ? a.noConnection : e instanceof ApiError ? e.message : a.failed);
    } finally { setSaving(false); }
  };
  return (
    <Sheet onClose={onClose} label={a.changePassword}>
      <h3>{a.changePassword}</h3>
      <PasswordField id="cp-cur" label={a.currentPassword} value={cur} onChange={setCur} show={show} onToggle={() => setShow(!show)} autoComplete="current-password" autoFocus />
      <div className="grp" style={{ gap: 8 }}>
        <PasswordField id="cp-new" label={a.newPassword} value={pw} onChange={setPw} show={show} onToggle={() => setShow(!show)} autoComplete="new-password" />
        <PasswordRules value={pw} />
      </div>
      <PasswordField id="cp-new2" label={a.repeatPassword} value={pw2} onChange={setPw2} show={show} onToggle={() => setShow(!show)} autoComplete="new-password" />
      {pw2 && pw !== pw2 && <p className="err">{a.noMatch}</p>}
      {error && <p className="err" role="alert">{error}</p>}
      <div className="acts"><button type="button" className="btn btn-primary btn-block" disabled={!ok || saving} onClick={() => void save()}>{t.common.save}</button></div>
    </Sheet>
  );
}
