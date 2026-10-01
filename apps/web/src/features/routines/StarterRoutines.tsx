import { addStarter, STARTERS, type StarterKey } from "@/db/actions";
import { useT } from "@/i18n";
import { useToast } from "@/ui/Toast";

/** Empty state: one tap adds a starter set of routines. */
export function StarterRoutines() {
  const toast = useToast();
  const t = useT().routines;
  return (
    <div className="grp">
      <p className="hint">{t.noRoutines}</p>
      <div className="card list">
        {(Object.keys(STARTERS) as StarterKey[]).map((key) => (
          <div className="starter" key={key}>
            <span className="li-main">
              <span className="li-name">{t.starter[key]}</span>
              <span className="li-meta">{t.routineCount(STARTERS[key].length)} · {STARTERS[key].map(([r]) => t.starterRoutine[r]).join(", ")}</span>
            </span>
            <button type="button" className="add-chip" onClick={() => void addStarter(key).then(() => toast(t.added(t.starter[key])))}>{t.add}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
