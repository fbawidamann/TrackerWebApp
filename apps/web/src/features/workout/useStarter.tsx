import { useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { discardWorkout, getActiveWorkout, startWorkout } from "@/db/actions";
import { Sheet } from "@/ui/Sheet";

type StartOpts = { routineId?: string; repeatActivityId?: string };

/**
 * Starts a workout, enforcing "only one workout at a time": if one is running,
 * shows Resume / Discard it and start new. Render `element` somewhere in the screen.
 */
export function useStarter(): { start: (opts?: StartOpts) => Promise<void>; element: ReactNode } {
  const navigate = useNavigate();
  const [conflict, setConflict] = useState<{ name: string; id: string; opts: StartOpts } | null>(null);

  const go = async (opts: StartOpts) => {
    await startWorkout(opts);
    void navigate({ to: "/workout" });
  };
  const start = async (opts: StartOpts = {}) => {
    const running = await getActiveWorkout();
    if (running) setConflict({ name: running.name, id: running.id, opts });
    else await go(opts);
  };

  const element = conflict && (
    <Sheet onClose={() => setConflict(null)} label="Workout running">
      <h3>{conflict.name} is still running</h3>
      <p>Only one workout can run at a time.</p>
      <div className="acts">
        <button type="button" className="btn btn-primary btn-block" onClick={() => { setConflict(null); void navigate({ to: "/workout" }); }}>Resume {conflict.name}</button>
        <button type="button" className="btn btn-block btn-danger" onClick={async () => {
          const c = conflict;
          setConflict(null);
          await discardWorkout(c.id);
          await go(c.opts);
        }}>Discard it and start new</button>
      </div>
    </Sheet>
  );
  return { start, element };
}
