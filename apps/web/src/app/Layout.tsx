import { formatClock } from "@fitness/shared";
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { discardWorkout, finishWorkout } from "@/db/actions";
import { seedCatalog } from "@/db/seed";
import { useAccount, useActiveWorkout, useDeviceSettings, useRest, useSessionExpired, useSettings } from "@/data/hooks";
import { LoginScreen } from "@/features/auth/LoginScreen";
import { restLabel } from "@/features/workout/RestPill";
import { rememberLanguage, setLanguage, useT } from "@/i18n";
import { useNow } from "@/lib/time";
import { IconChevron, IconHistory, IconHome, IconLift, IconList, IconRun, IconUser } from "@/ui/icons";
import { Sheet } from "@/ui/Sheet";
import { ToastProvider } from "@/ui/Toast";
import { useApplyTheme } from "./theme";

const NAV = [
  { to: "/", key: "home", icon: IconHome, match: (p: string) => p === "/" },
  { to: "/history", key: "history", icon: IconHistory, match: (p: string) => p.startsWith("/history") },
  { to: "/workout", key: "workout", icon: IconLift, match: (p: string) => p.startsWith("/workout") || p.startsWith("/routines") },
  { to: "/running", key: "running", icon: IconRun, match: (p: string) => p.startsWith("/running") },
  { to: "/exercises", key: "exercises", icon: IconList, match: (p: string) => p.startsWith("/exercises") },
  { to: "/profile", key: "profile", icon: IconUser, match: (p: string) => p.startsWith("/profile") },
] as const;

/** Screens that hide the bottom nav (full-screen flows). */
const noNav = (p: string) => p.startsWith("/workout/done") || p.endsWith("/edit") || p === "/history/new" || p === "/routines/new" || p === "/running/new";

let staleChecked = false;

export function Layout() {
  const settings = useSettings();
  const device = useDeviceSettings();
  const t = useT();
  useApplyTheme(settings, device);
  // The language for code outside React (actions, file import). Set while rendering, so it is never a frame late.
  setLanguage(settings.language);
  useEffect(() => {
    document.documentElement.lang = settings.language;
    rememberLanguage(settings.language);
    // Built-in exercises are stored in the chosen language (docs/adr/0007-german-language.md).
    void seedCatalog(settings.language);
  }, [settings.language]);
  const { pathname } = useLocation();
  const account = useAccount();
  const expired = useSessionExpired();
  const gated = account === null || expired;
  const hideNav = noNav(pathname) || gated;
  useEffect(() => { document.body.classList.toggle("no-nav", hideNav); }, [hideNav]);
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  // Locked until the first login on this device (docs/design/screens/login.md). Offline starts work once logged in.
  if (account === undefined) return null;
  if (gated) return <ToastProvider><div className="safe-cover" /><LoginScreen expired={expired && account !== null} /></ToastProvider>;

  return (
    <ToastProvider>
      <div className="safe-cover" />
      <div className="app-shell">
        <Outlet />
      </div>
      {!hideNav && <MiniBar pathname={pathname} />}
      {!hideNav && (
        <nav className="nav" aria-label={t.nav.main}>
          <span className="brand">Fitness</span>
          {NAV.map(({ to, key, icon: Icon, match }) => (
            <Link key={to} to={to} className={match(pathname) ? "on" : ""} aria-current={match(pathname) ? "page" : undefined}>
              <Icon /><span>{t.nav[key]}</span>
            </Link>
          ))}
        </nav>
      )}
      <StaleWorkoutCheck />
    </ToastProvider>
  );
}

/** "Push Day · 34:12 ›" above the nav on every screen except the workout itself and Home (which has the Resume card). */
function MiniBar({ pathname }: { pathname: string }) {
  const active = useActiveWorkout();
  const rest = useRest();
  const settings = useSettings();
  const t = useT();
  const now = useNow(1000);
  if (!active || pathname === "/workout" || pathname === "/") return null;
  return (
    <div className="float-bottom">
      <Link to="/workout" className="minibar" style={{ textDecoration: "none", color: "inherit" }} aria-label={t.layout.backToWorkout}>
        <span><b>{active.activity.name}</b> <span className="muted">·</span> {formatClock((now - new Date(active.activity.startedAt).getTime()) / 1000)}</span>
        <span className="rt">{rest && settings.restTimerEnabled ? <>{t.layout.rest} {restLabel(rest, now)}</> : null}<IconChevron /></span>
      </Link>
    </div>
  );
}

/** A workout left running for more than 12 h: ask once per app start. */
function StaleWorkoutCheck() {
  const active = useActiveWorkout();
  const navigate = useNavigate();
  const t = useT();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (staleChecked || active === undefined) return;
    staleChecked = true;
    if (active && Date.now() - new Date(active.activity.startedAt).getTime() > 12 * 3600_000) setOpen(true);
  }, [active]);
  if (!open || !active) return null;
  return (
    <Sheet onClose={() => setOpen(false)} label={t.layout.staleLabel}>
      <h3>{t.layout.staleTitle}</h3>
      <p>{t.layout.staleText(active.activity.name)}</p>
      <div className="acts">
        <button type="button" className="btn btn-primary btn-block" onClick={async () => {
          setOpen(false);
          await finishWorkout(active.activity.id);
          void navigate({ to: "/workout/done/$activityId", params: { activityId: active.activity.id } });
        }}>{t.layout.finish}</button>
        <button type="button" className="btn btn-block btn-danger" onClick={() => { setOpen(false); void discardWorkout(active.activity.id); }}>{t.common.discard}</button>
        <button type="button" className="btn btn-block" onClick={() => setOpen(false)}>{t.layout.keepRunning}</button>
      </div>
    </Sheet>
  );
}
