import { offComplete, type Food, type OffProduct } from "@fitness/shared";
import { useEffect, useMemo, useState } from "react";
import { api, NetworkError } from "@/api/client";
import { useFoodEntries, useFoods, useSettings } from "@/data/hooks";
import { db } from "@/db/db";
import { foodByBarcode, foodFromOff, type FoodInput } from "@/db/nutrition";
import { useT } from "@/i18n";
import { quickFoods, searchFoods } from "@/lib/nutrition";
import { useFormat } from "@/lib/useFormat";
import { IconBarcode, IconClose, IconPlus, IconSearch } from "@/ui/icons";
import { Overlay } from "@/ui/Overlay";
import { useToast } from "@/ui/Toast";
import { AmountSheet } from "./AmountSheet";
import { FoodForm } from "./FoodForm";
import { ScannerOverlay } from "./ScannerOverlay";

type Pick = { food: Food; lastAmount?: number };

/**
 * Add food (full-screen): search on top, Recent / Frequent when empty, then own foods + Open Food Facts.
 * Multi-add: after "Add" the search stays open for the next item. `startWithScan` opens the camera right away.
 */
export function AddFood({ day, startWithScan, onClose }: { day: Date; startWithScan?: boolean; onClose: () => void }) {
  const t = useT();
  const n = t.nutrition;
  const fmt = useFormat();
  const toast = useToast();
  const settings = useSettings();
  const foods = useFoods();
  const entries = useFoodEntries();
  const [q, setQ] = useState("");
  const [off, setOff] = useState<{ q: string; list: OffProduct[]; state: "idle" | "loading" | "error" | "offline" }>({ q: "", list: [], state: "idle" });
  const [pick, setPick] = useState<Pick | null>(null);
  const [form, setForm] = useState<{ food?: Food; initial?: Partial<FoodInput> } | null>(null);
  const [scan, setScan] = useState(!!startWithScan);
  const [lookup, setLookup] = useState<string | null>(null);

  const quick = useMemo(() => quickFoods(entries ?? [], foods ?? []), [entries, foods]);
  const local = useMemo(() => searchFoods(foods ?? [], q), [foods, q]);
  const lastAmountOf = (id: string) => [...quick.recent, ...quick.frequent].find((x) => x.food.id === id)?.lastAmount;

  // Open Food Facts search: debounced 450 ms (their search limit is ~10/min per IP; the server caches too).
  useEffect(() => {
    const query = q.trim();
    if (query.length < 3) { setOff({ q: "", list: [], state: "idle" }); return; }
    if (!navigator.onLine) { setOff({ q: query, list: [], state: "offline" }); return; }
    setOff((o) => ({ ...o, state: "loading" }));
    let cancelled = false;
    const id = window.setTimeout(() => {
      api<{ products: OffProduct[] }>("GET", `/api/food/search?q=${encodeURIComponent(query)}&lang=${settings.language}`)
        .then((r) => { if (!cancelled) setOff({ q: query, list: r.products, state: "idle" }); })
        .catch((e) => { if (!cancelled) setOff({ q: query, list: [], state: e instanceof NetworkError ? "offline" : "error" }); });
    }, 450);
    return () => { cancelled = true; window.clearTimeout(id); };
  }, [q, settings.language]);

  const known = new Set((foods ?? []).filter((f) => f.barcode && !f.deletedAt).map((f) => f.barcode));
  const offList = off.list.filter((p) => !known.has(p.barcode));

  const chooseOff = async (p: OffProduct) => {
    const food = await foodFromOff(p);
    if (offComplete(p)) setPick({ food });
    else setForm({ food });
  };

  const onCode = async (code: string) => {
    setScan(false);
    const local = await foodByBarcode(code);
    if (local) { setPick({ food: local, lastAmount: lastAmountOf(local.id) }); return; }
    setLookup(code);
    try {
      const r = await api<{ product: OffProduct | null }>("GET", `/api/food/product/${code}`);
      if (r.product) {
        const food = await foodFromOff(r.product);
        if (offComplete(r.product)) setPick({ food });
        else { toast(n.missingValues); setForm({ food }); }
      } else {
        toast(n.scanUnknown(code));
        setForm({ initial: { barcode: code } });
      }
    } catch (e) {
      toast(e instanceof NetworkError ? n.offline : (e as Error).message || n.offError);
      setForm({ initial: { barcode: code } });
    } finally {
      setLookup(null);
    }
  };

  const row = (key: string, food: { name: string; brand: string | null; kcal: number | null; protein: number | null; unit: string },
    onClick: () => void, side?: string) => (
    <button key={key} type="button" className="li food-li" onClick={onClick}>
      <span className="li-main">
        <span className="li-name">{food.name}</span>
        <span className="li-meta">
          {[food.brand, `${fmt.num(food.kcal ?? 0, 0)} kcal · ${fmt.num(food.protein ?? 0, 1)} g ${n.protein} ${n.per100(food.unit)}`].filter(Boolean).join(" · ")}
        </span>
      </span>
      {side && <span className="li-side">{side}</span>}
      <span className="add-dot" aria-hidden="true"><IconPlus /></span>
    </button>
  );

  const query = q.trim();
  return (
    <Overlay label={n.add} onEscape={onClose}>
      <div className="ov-head">
        <button type="button" className="ib" onClick={onClose} aria-label={t.common.close}><IconClose /></button>
        <h2>{n.add}</h2>
        <button type="button" className="ib" onClick={() => setForm({ initial: { name: query } })} aria-label={n.createFood}><IconPlus /></button>
      </div>
      <div className="add-search">
        <label className="search">
          <IconSearch />
          <input className="field" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={n.search} aria-label={n.search}
            autoFocus={!startWithScan} enterKeyHint="search" autoComplete="off" autoCorrect="off" spellCheck={false} />
        </label>
        <button type="button" className="btn scan-btn" onClick={() => setScan(true)} aria-label={n.scanTitle}><IconBarcode /><span>{n.scan}</span></button>
      </div>
      <div className="ov-body">
        <div className="ov-inner">
          {!query && (
            <>
              {quick.recent.length > 0 && (
                <div className="sec"><span className="lbl">{n.recent}</span>
                  <div className="card list">{quick.recent.map((x) => row(x.food.id, x.food, () => setPick({ food: x.food, lastAmount: x.lastAmount }), `${fmt.num(x.lastAmount, 1)} ${x.food.unit}`))}</div>
                </div>
              )}
              {quick.frequent.length > 0 && (
                <div className="sec"><span className="lbl">{n.frequent}</span>
                  <div className="card list">{quick.frequent.map((x) => row(x.food.id, x.food, () => setPick({ food: x.food, lastAmount: x.lastAmount }), `${x.count}×`))}</div>
                </div>
              )}
              {!quick.recent.length && <p className="hint">{n.noEntriesHint}</p>}
            </>
          )}
          {query && (
            <>
              {local.length > 0 && (
                <div className="sec"><span className="lbl">{n.yourFoods}</span>
                  <div className="card list">{local.map((f) => row(f.id, f, () => setPick({ food: f, lastAmount: lastAmountOf(f.id) })))}</div>
                </div>
              )}
              <div className="sec">
                <span className="lbl">{n.offResults}</span>
                {off.state === "loading" || (query.length >= 3 && off.q !== query && off.state !== "offline") ? <p className="hint">{n.searching}</p>
                  : off.state === "offline" ? <p className="hint">{n.offline}</p>
                  : off.state === "error" ? <p className="hint">{n.offError}</p>
                  : offList.length ? <div className="card list">{offList.map((p) => row(p.barcode, p, () => void chooseOff(p)))}</div>
                  : query.length >= 3 ? <p className="hint">{n.noResults}</p> : null}
              </div>
              <button type="button" className="btn btn-block" onClick={() => setForm({ initial: { name: query } })}><IconPlus />{n.createNamed(query)}</button>
              <p className="hint attribution">{n.attribution}</p>
            </>
          )}
        </div>
      </div>
      {lookup && <div className="busy-note" role="status">{n.scanLookup}</div>}
      {scan && <ScannerOverlay onCode={(c) => void onCode(c)} onClose={() => setScan(false)} />}
      {form && (
        <FoodForm food={form.food} initial={form.initial} onClose={() => setForm(null)}
          onSaved={async (id) => {
            setForm(null);
            const f = await db.foods.get(id);
            if (f) setPick({ food: f });
          }} />
      )}
      {pick && (
        <AmountSheet food={pick.food} day={day} lastAmount={pick.lastAmount} onClose={() => setPick(null)}
          onEditFood={() => { const f = pick.food; setPick(null); setForm({ food: f }); }}
          onDone={(name) => { setPick(null); setQ(""); toast(n.added(name)); }} />
      )}
    </Overlay>
  );
}
