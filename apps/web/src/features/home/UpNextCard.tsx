import type { MuscleGroup } from "@fitness/shared";
import type { RoutineView } from "@/data/hooks";
import { useT } from "@/i18n";
import { useFormat } from "@/lib/useFormat";
import { IconPlay } from "@/ui/icons";

/**
 * "Up next" card on Home (docs/design/screens/home.md → Up next): the routine that is due in the rotation.
 * The text part opens the preview sheet, the Start chip starts it right away (two separate buttons, never nested).
 */
export function UpNextCard({ view, groups, lastDone, onOpen, onStart }: {
  view: RoutineView; groups: MuscleGroup[]; lastDone: Date | undefined; onOpen: () => void; onStart: () => void;
}) {
  const t = useT();
  const fmt = useFormat();
  const name = view.routine.name;
  const meta = [
    groups.length ? groups.map((g) => t.group[g]).join(" · ") : t.common.exercises(view.items.length),
    lastDone ? t.home.lastDone(fmt.relDay(lastDone)) : t.home.neverDone,
  ].join(" · ");
  return (
    <div className="card upnext">
      <button type="button" className="upnext-main" onClick={onOpen}>
        <span className="lbl">{t.home.upNext}</span>
        <span className="upnext-name">{name}</span>
        <span className="li-meta">{meta}</span>
      </button>
      <button type="button" className="upnext-go" onClick={onStart} aria-label={t.home.startAria(name)}>
        <IconPlay />
        <span>{t.home.start}</span>
      </button>
    </div>
  );
}
