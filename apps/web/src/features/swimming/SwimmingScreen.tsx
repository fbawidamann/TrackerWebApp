import { useT } from "@/i18n";
import { IconSwim } from "@/ui/icons";

/** Swimming placeholder (docs/roadmap.md, next phase). Reachable from "More", marked "In progress". */
export function SwimmingScreen() {
  const s = useT().swimming;
  return (
    <div className="page">
      <h1 className="title">{s.title} <span className="soon">{s.badge}</span></h1>
      <div className="card empty swim-empty">
        <span className="swim-ic"><IconSwim /></span>
        <p>{s.text}</p>
        <p className="small">{s.hint}</p>
      </div>
    </div>
  );
}
