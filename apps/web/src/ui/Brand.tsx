import { useId } from "react";
import { useT } from "@/i18n";

/** The app icon ("Goal Ring"), same artwork as assets/app-icon.svg. The ring draws itself once when `animate` is set. */
export function AppIcon({ animate = false }: { animate?: boolean }) {
  const u = useId().replace(/:/g, "");
  const t = useT();
  return (
    <svg viewBox="0 0 100 100" role="img" aria-label={t.ui.appIcon}>
      <defs>
        <linearGradient id={`bg${u}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1D2536" /><stop offset="1" stopColor="#06080C" /></linearGradient>
        <radialGradient id={`sh${u}`} cx=".22" cy=".08" r=".85"><stop offset="0" stopColor="#fff" stopOpacity=".11" /><stop offset=".6" stopColor="#fff" stopOpacity="0" /></radialGradient>
        <radialGradient id={`ha${u}`} cx=".5" cy=".55" r=".5"><stop offset="0" stopColor="#4F86F7" stopOpacity=".28" /><stop offset="1" stopColor="#4F86F7" stopOpacity="0" /></radialGradient>
        <linearGradient id={`ar${u}`} x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#2450D4" /><stop offset=".6" stopColor="#4F86F7" /><stop offset="1" stopColor="#A9C4FF" /></linearGradient>
        <linearGradient id={`db${u}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFFFFF" /><stop offset="1" stopColor="#A9B4C6" /></linearGradient>
        <filter id={`gl${u}`} x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <filter id={`ds${u}`} x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1.6" stdDeviation="1.4" floodColor="#000" floodOpacity=".6" /></filter>
      </defs>
      <rect width="100" height="100" fill={`url(#bg${u})`} />
      <rect width="100" height="100" fill={`url(#ha${u})`} />
      <rect width="100" height="100" fill={`url(#sh${u})`} />
      <circle cx="50" cy="50" r="30" fill="none" stroke="#1A2233" strokeWidth="9.5" />
      <circle className={animate ? "icon-arc draw" : "icon-arc"} cx="50" cy="50" r="30" fill="none" stroke={`url(#ar${u})`} strokeWidth="9.5" strokeLinecap="round" transform="rotate(-90 50 50)" filter={`url(#gl${u})`} />
      <g filter={`url(#ds${u})`} fill={`url(#db${u})`}>
        <rect x="37.5" y="48.3" width="25" height="3.4" rx="1.7" />
        <rect x="33.5" y="40" width="5.6" height="20" rx="2.2" />
        <rect x="60.9" y="40" width="5.6" height="20" rx="2.2" />
        <rect x="29.6" y="43.5" width="4.2" height="13" rx="1.8" />
        <rect x="66.2" y="43.5" width="4.2" height="13" rx="1.8" />
      </g>
    </svg>
  );
}

/** Full-screen waiting state with the icon's ring: "fill" for data transfer, "spin" for short waits. */
export function BusyOverlay({ title, sub, kind = "spin" }: { title: string; sub?: string; kind?: "spin" | "fill" }) {
  return (
    <div className="busy" role="status" aria-live="polite">
      <svg className={`ring ${kind}`} viewBox="0 0 100 100" aria-hidden="true">
        <circle className="track" cx="50" cy="50" r="40" fill="none" strokeWidth="7" />
        <circle className="arc" cx="50" cy="50" r="40" fill="none" strokeWidth="7" strokeLinecap="round" />
        <g className="db">
          <rect x="37.5" y="48.4" width="25" height="3.2" rx="1.6" />
          <rect x="33.8" y="41" width="5" height="18" rx="2" />
          <rect x="61.2" y="41" width="5" height="18" rx="2" />
          <rect x="30.3" y="44.2" width="3.8" height="11.6" rx="1.6" />
          <rect x="65.9" y="44.2" width="3.8" height="11.6" rx="1.6" />
        </g>
      </svg>
      <b>{title}</b>
      {sub && <span className="hint">{sub}</span>}
    </div>
  );
}
