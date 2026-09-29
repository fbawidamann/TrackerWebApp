import { addStarter, STARTERS } from "@/db/actions";
import { useToast } from "@/ui/Toast";

/** Empty state: one tap adds a starter set of routines. */
export function StarterRoutines() {
  const toast = useToast();
  return (
    <div className="grp">
      <p className="hint">No routines yet</p>
      <div className="card list">
        {Object.entries(STARTERS).map(([key, s]) => (
          <div className="starter" key={key}>
            <span className="li-main">
              <span className="li-name">{s.name}</span>
              <span className="li-meta">{s.routines.length} {s.routines.length === 1 ? "routine" : "routines"} · {s.routines.map((r) => r[0]).join(", ")}</span>
            </span>
            <button type="button" className="add-chip" onClick={() => void addStarter(key).then(() => toast(`${s.name} added`))}>Add</button>
          </div>
        ))}
      </div>
    </div>
  );
}
