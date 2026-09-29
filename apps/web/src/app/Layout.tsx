import { formatClock } from "@fitness/shared";
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { discardWorkout, finishWorkout } from "@/db/actions";
import { useActiveWorkout, useDeviceSettings, useRest, useSettings } from "@/data/hooks";
import { restLabel } from "@/features/workout/RestPill";
import { useNow } from "@/lib/time";
import { IconChevron, IconHistory, IconHome, IconLift, IconList, IconUser } from "@/ui/icons";
import { Sheet } from "@/ui/Sheet";
import { ToastProvider } from "@/ui/Toast";
import { useApplyTheme } from "./theme";

const NAV = [
  { to: "/", label: "Home", icon: IconHome, match: (p: string) => p === "/" },
  { to: "/history", label: "History", icon: IconHistory, match: (p: string) => p.startsWith("/history") },
  { to: "/workout", label: "Workout", icon: IconLift, match: (p: string) => p.startsWith("/workout") || p.startsWith("/routines") },
  { to: "/exercises", label: "Exercises", icon: IconList, match: (p: string) => p.startsWith("/exercises") },
  { to: "/profile", label: "Profile", icon: IconUser, match: (p: string) => p.startsWith("/profile") },
] as const;

/** Screens that hide the bottom nav (full-screen flows). */
const noNav = (p: string) => p.startsWith("/workout/done") || p.endsWith("/edit") || p === "/history/new" || p === "/routines/new";

let staleChecked = false;

export function Layout() {
  const settings = useSettings();
  const device = useDeviceSettings();
  useApplyTheme(settings, device);
  const { pathname } = useLocation();
  const hideNav = noNav(pathname);
  useEffect(() => { document.body.classList.toggle("no-nav", hideNav); }, [hideNav]);
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  return (
    <ToastProvider>
      <div className="safe-cover" />
      <div className="app-shell">
        <Outlet />
      </div>
      {!hideNav && <MiniBar pathname={pathname} />}
      {!hideNav && (
        <nav className="nav" aria-label="Main">
          <span className="brand">Fitness</span>
          {NAV.map(({ to, label, icon: Icon, match }) => (
            <Link key={to} to={to} className={match(pathname) ? "on" : ""} aria-current={match(pathname) ? "page" : undefined}>
              <Icon /><span>{label}</span>
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
  const now = useNow(1000);
  if (!active || pathname === "/workout" || pathname === "/") return null;
  return (
    <div className="float-bottom">
      <Link to="/workout" className="minibar" style={{ textDecoration: "none", color: "inherit" }} aria-label="Back to workout">
        <span><b>{active.activity.name}</b> <span className="muted">·</span> {formatClock((now - new Date(active.activity.startedAt).getTime()) / 1000)}</span>
        <span className="rt">{rest && settings.restTimerEnabled ? <>Rest {restLabel(rest, now)}</> : null}<IconChevron /></span>
      </Link>
    </div>
  );
}

/** A workout left running for more than 12 h: ask once per app start. */
function StaleWorkoutCheck() {
  const active = useActiveWorkout();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (staleChecked || active === undefined) return;
    staleChecked = true;
    if (active && Date.now() - new Date(active.activity.startedAt).getTime() > 12 * 3600_000) setOpen(true);
  }, [active]);
  if (!open || !active) return null;
  return (
    <Sheet onClose={() => setOpen(false)} label="Unfinished workout">
      <h3>Finish or discard the workout from yesterday?</h3>
      <p>{active.activity.name} is still running.</p>
      <div className="acts">
        <button type="button" className="btn btn-primary btn-block" onClick={async () => {
          setOpen(false);
          await finishWorkout(active.activity.id);
          void navigate({ to: "/workout/done/$activityId", params: { activityId: active.activity.id } });
        }}>Finish</button>
        <button type="button" className="btn btn-block btn-danger" onClick={() => { setOpen(false); void discardWorkout(active.activity.id); }}>Discard</button>
        <button type="button" className="btn btn-block" onClick={() => setOpen(false)}>Keep it running</button>
      </div>
    </Sheet>
  );
}
