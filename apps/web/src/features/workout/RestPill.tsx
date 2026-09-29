import { formatClock } from "@fitness/shared";
import { useState } from "react";
import { adjustRest, stopRest, type RestState } from "@/db/actions";
import { useNow } from "@/lib/time";

export function restRemaining(rest: RestState, now: number): number {
  return rest.duration - Math.max(0, now - rest.startedAt) / 1000;
}

export function restLabel(rest: RestState, now: number): string {
  const left = restRemaining(rest, now);
  return left > 0 ? formatClock(Math.ceil(left)) : "+" + formatClock(-left);
}

/** Floating rest timer above the nav. At zero it counts up muted — no sound, no vibration. */
export function RestPill({ rest }: { rest: RestState }) {
  const now = useNow(500);
  const [expanded, setExpanded] = useState(false);
  const left = restRemaining(rest, now);
  const over = left <= 0;
  return (
    <div className="float-bottom">
      <div className={"rest" + (over ? " over" : "")} role="timer" aria-label="Rest timer">
        <span className="lbl">Rest</span>
        <span className="rbar"><i style={{ width: `${over ? 100 : Math.max(0, (left / rest.duration) * 100)}%` }} /></span>
        <button type="button" className="rest-t" onClick={() => setExpanded(!expanded)} aria-label="Adjust rest time" aria-expanded={expanded}>
          {restLabel(rest, now)}
        </button>
        {expanded && (
          <>
            <button type="button" className="radj" onClick={() => void adjustRest(-15)}>−15</button>
            <button type="button" className="radj" onClick={() => void adjustRest(15)}>+15</button>
          </>
        )}
        <button type="button" className="skip" onClick={() => void stopRest()}>Skip</button>
      </div>
    </div>
  );
}
