import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n";
import { IconPlus } from "./icons";

/** How long the start animation plays before the workout opens (ms). Matches the CSS in app.css ("Start button"). */
export const START_ANIM_MS = 520;
const SPARKS = 8;

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/**
 * "+ Start workout" primary button with a launch animation (docs/design/ui-guidelines.md "Start button"):
 * the plus spins and grows, a ring and sparks burst out of it, a light sweep runs across and the button pops.
 * Only transform/opacity are animated (smooth on the iPhone). With reduced motion it starts immediately.
 */
export function StartWorkoutButton({ onStart }: { onStart: () => void }) {
  const t = useT();
  const [going, setGoing] = useState(false);
  const busy = useRef(false); // a ref, not state: two taps in the same frame must not both start a workout
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const click = () => {
    if (busy.current) return;
    busy.current = true;
    if (reducedMotion()) { onStart(); busy.current = false; return; }
    setGoing(true);
    timer.current = window.setTimeout(() => { busy.current = false; setGoing(false); onStart(); }, START_ANIM_MS);
  };

  return (
    <button type="button" className={"btn btn-primary btn-block start-btn" + (going ? " go" : "")} onClick={click} aria-busy={going || undefined}>
      <span className="start-plus" aria-hidden="true">
        <IconPlus />
        <i className="start-ring" />
        {Array.from({ length: SPARKS }, (_, i) => <i key={i} className="start-spark" style={{ ["--a" as string]: `${(360 / SPARKS) * i}deg` }} />)}
      </span>
      <span>{t.home.startWorkout}</span>
    </button>
  );
}
