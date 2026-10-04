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
import { IconChart, IconChevron, IconFood, IconGrid, IconHistory, IconHome, IconLift, IconList, IconRun, IconSwim, IconUser } from "@/ui/icons";
import { Sheet } from "@/ui/Sheet";
import { ToastProvider } from "@/ui/Toast";
import { useApplyTheme } from "./theme";
import { UpdateBanner } from "./UpdateBanner";
import { autoImportStrava } from "@/features/strava/strava";
import { useToast } from "@/ui/Toast";

/** Bottom nav on phones: Home, Workout, Nutrition plus "More" (docs/design/ui-guidelines.md "Bottom navigation"). */
const NAV = [
  { to: "/", key: "home", icon: IconHome, match: (p: string) => p === "/" },
  { to: "/workout", key: "workout", icon: IconLift, match: (p: string) => p.startsWith("/workout") || p.startsWith("/routines") },
  { to: "/nutrition", key: "nutrition", icon: IconFood, match: (p: string) => p.startsWith("/nutrition") },
] as const;

/** Behind "More" on phones; listed directly in the desktop sidebar. */
export const MORE = [
  { to: "/history", key: "history", icon: IconHistory, match: (p: string) => p.startsWith("/history"), soon: false },
  { to: "/running", key: "running", icon: IconRun, match: (p: string) => p.startsWith("/running"), soon: false },
  { to: "/swimming", key: "swimming", icon: IconSwim, match: (p: string) => p.startsWith("/swimming"), soon: true },
  { to: "/stats", key: "stats", icon: IconChart, match: (p: string) => p.startsWith("/stats"), soon: false },
  { to: "/exercises", key: "exercises", icon: IconList, match: (p: string) => p.startsWith("/exercises"), soon: false },
  // Profile left the bottom bar for Nutrition (2026-10-04); also reachable by tapping the name on Home.
  { to: "/profile", key: "profile", icon: IconUser, match: (p: string) => p.startsWith("/profile"), soon: false },
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
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => { setMoreOpen(false); }, [pathname]);
  const inMore = MORE.some((m) => m.match(pathname));

  // Locked until the first login on this device (docs/design/screens/login.md). Offline starts work once logged in.
  if (account === undefined) return null;
  if (gated) return <ToastProvider><div className="safe-cover" /><LoginScreen expired={expired && account !== null} /><UpdateBanner /></ToastProvider>;

  return (
    <ToastProvider>
      <div className="safe-cover" />
      <UpdateBanner />
      <div className="app-shell">
        <Outlet />
      </div>
      {!hideNav && <MiniBar pathname={pathname} />}
      {!hideNav && (
        <nav className="nav" aria-label={t.nav.main}>
          <span className="brand">Fitness</span>
          {/* Order in the desktop sidebar: Home, Workout, Nutrition, then the More items (Profile last). On phones .nav-extra is hidden. */}
          {NAV.map(({ to, key, icon: Icon, match }) => (
            <Link key={to} to={to} className={match(pathname) ? "on" : ""} aria-current={match(pathname) ? "page" : undefined}>
              <Icon /><span>{t.nav[key]}</span>
            </Link>
          ))}
          {MORE.map(({ to, key, icon: Icon, match }) => (
            <Link key={to} to={to} className={"nav-extra" + (match(pathname) ? " on" : "")} aria-current={match(pathname) ? "page" : undefined}>
              <Icon /><span>{t.nav[key]}</span>
            </Link>
          ))}
          <button type="button" className={"nav-more" + (moreOpen || inMore ? " on" : "")} aria-haspopup="dialog" aria-expanded={moreOpen}
            onClick={() => setMoreOpen(true)}>
            <IconGrid /><span>{t.nav.more}</span>
          </button>
        </nav>
      )}
      {moreOpen && !hideNav && <MoreSheet pathname={pathname} onClose={() => setMoreOpen(false)} />}
      <StaleWorkoutCheck />
      <StravaAutoImport />
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

/** The "More" sheet: everything that is not one of the three main tabs, with a short hint per item. */
function MoreSheet({ pathname, onClose }: { pathname: string; onClose: () => void }) {
  const t = useT();
  const navigate = useNavigate();
  return (
    <Sheet onClose={onClose} label={t.nav.more}>
      <h3>{t.nav.more}</h3>
      <div className="more-list">
        {MORE.map(({ to, key, icon: Icon, match, soon }) => (
          <button key={to} type="button" className={"more-item" + (match(pathname) ? " on" : "")}
            aria-current={match(pathname) ? "page" : undefined}
            onClick={() => { onClose(); void navigate({ to }); }}>
            <span className="more-ic"><Icon /></span>
            <span className="li-main">
              <span className="li-name">{t.nav[key]}{soon && <span className="soon">{t.nav.inProgress}</span>}</span>
              <span className="li-meta">{t.nav.moreHint[key]}</span>
            </span>
            <IconChevron className="more-chev" />
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/** Pulls new Strava runs when the app opens or comes back to the foreground (at most every 15 min, silent on errors). */
function StravaAutoImport() {
  const toast = useToast();
  const t = useT();
  useEffect(() => {
    const run = () => {
      if (document.visibilityState !== "visible") return;
      void autoImportStrava().then((n) => { if (n) toast(t.strava.imported(n)); }).catch(() => {});
    };
    run();
    document.addEventListener("visibilitychange", run);
    return () => document.removeEventListener("visibilitychange", run);
  }, [toast, t]);
  return null;
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
