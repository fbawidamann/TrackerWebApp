import { useState, type FormEvent } from "react";
import { ApiError, NetworkError } from "@/api/client";
import { useT } from "@/i18n";
import { login, localWorkoutCount } from "@/sync/account";
import { AppIcon, BusyOverlay } from "@/ui/Brand";
import { PasswordField } from "@/ui/Password";

/**
 * Login gate (docs/design/screens/login.md). No registration: accounts are created by the admin.
 * After success the app opens (Home); local data from before the first login is uploaded.
 */
export function LoginScreen({ expired = false }: { expired?: boolean }) {
  const t = useT();
  const a = t.auth;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<{ title: string; sub?: string; kind: "spin" | "fill" } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!navigator.onLine) { setError(a.noConnection); return; }
    setBusy({ title: a.loggingIn, kind: "spin" });
    let showUpload = 0;
    try {
      const n = await localWorkoutCount();
      showUpload = window.setTimeout(() => setBusy(n
        ? { title: a.uploading, sub: t.common.workouts(n), kind: "fill" }
        : { title: a.loading, kind: "fill" }), 500);
      await login(username.trim(), password);
      window.clearTimeout(showUpload);
      // The account is now stored; the layout switches to the app by itself.
    } catch (err) {
      // Also cancel the pending "Loading…" switch, or it brings the overlay back after a slow failed login.
      window.clearTimeout(showUpload);
      setBusy(null);
      if (err instanceof NetworkError) setError(a.noConnection);
      else if (err instanceof ApiError && (err.status === 401 || err.status === 429 || err.status === 400)) setError(err.message);
      else setError(a.failed);
    }
  };

  return (
    <main className="login">
      <div className="brand-block">
        <div className="appicon"><AppIcon animate /></div>
        <h1>Fitness</h1>
        <p>{expired ? a.expired : a.welcome}</p>
      </div>
      <form className="grp" style={{ gap: 18 }} onSubmit={(e) => void submit(e)}>
        <div className="grp" style={{ gap: 8 }}>
          <label className="lbl" htmlFor="login-user">{a.username}</label>
          <input id="login-user" className="field" autoComplete="username" autoCapitalize="none" spellCheck={false}
            value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <PasswordField id="login-pw" label={a.password} value={password} onChange={setPassword} show={show} onToggle={() => setShow(!show)} autoComplete="current-password" />
        {error && <p className="err" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={!username.trim() || !password || !!busy}>{a.logIn}</button>
      </form>
      <p className="hint" style={{ textAlign: "center" }}>{a.adminOnly}</p>
      {busy && <BusyOverlay title={busy.title} sub={busy.sub} kind={busy.kind} />}
    </main>
  );
}
