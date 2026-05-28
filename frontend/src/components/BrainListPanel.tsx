import { useMemo } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { useStore } from "../store";
import type { BrainSummary, Condition } from "../lib/api";
import { Panel } from "./Panel";

const CONDITION_DOT: Record<Condition, string> = {
  Control: "bg-(--color-control)",
  Semaglutide: "bg-(--color-semaglutide)",
};

const CONDITION_TEXT: Record<Condition, string> = {
  Control: "text-(--color-control)",
  Semaglutide: "text-(--color-semaglutide)",
};

function shortDate(scanName: string): string {
  // scan_name looks like "260219_AN0B2_G002_mouse_brain_MB1_SCAN0_11-56-32"
  const [d] = scanName.split("_");
  if (!/^\d{6}$/.test(d)) return scanName;
  return `${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4, 6)}`;
}

function BrainItem({ brain }: { brain: BrainSummary }) {
  const selected = useStore((s) => s.selectedScanName === brain.scan_name);
  const selectBrain = useStore((s) => s.selectBrain);

  return (
    <button
      type="button"
      onClick={() => selectBrain(brain.scan_name)}
      className={
        "group block w-full border-l-2 px-3 py-2 text-left transition-colors " +
        (selected
          ? "border-(--color-highlight) bg-white/[0.04]"
          : "border-transparent hover:bg-white/[0.025]")
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={
            "font-mono text-[13px] tracking-tight " +
            (selected ? "text-(--color-fg)" : "text-(--color-fg)/90")
          }
        >
          {brain.animal_nr}
        </span>
        <span className="font-mono text-[10px] text-(--color-fg-dim)">
          {brain.n_patches.toLocaleString()}
        </span>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <span
          className={
            "inline-flex items-center gap-1.5 text-[10px] tracking-wide uppercase " +
            CONDITION_TEXT[brain.condition]
          }
        >
          <span className={"inline-block size-1.5 rounded-full " + CONDITION_DOT[brain.condition]} />
          {brain.condition}
        </span>
        <span className="font-mono text-[10px] text-(--color-fg-dim)">{shortDate(brain.scan_name)}</span>
      </div>
    </button>
  );
}

export function BrainListPanel() {
  const brains = useStore((s) => s.brains);
  const loading = useStore((s) => s.brainsLoading);
  const error = useStore((s) => s.brainsError);

  const sorted = useMemo(() => {
    return [...brains].sort((a, b) => {
      if (a.condition !== b.condition) return a.condition === "Control" ? -1 : 1;
      return a.animal_nr.localeCompare(b.animal_nr);
    });
  }, [brains]);

  const right = brains.length > 0 ? (
    <span className="font-mono text-[10px] text-(--color-fg-dim)">{brains.length}</span>
  ) : null;

  return (
    <Panel
      title="Brains"
      right={right}
      bodyClassName="overflow-y-auto"
      help="The 12 mouse brain scans in this dataset. G001 = Vehicle/control, G002 = Semaglutide. The number next to each brain is its patch count. Click a brain to load its patches into the explore view."
    >
      {loading && brains.length === 0 && (
        <div className="flex h-full items-center justify-center gap-2 text-xs text-(--color-fg-dim)">
          <Loader2 size={14} className="animate-spin" />
          Loading…
        </div>
      )}
      {error && (
        <div className="flex h-full items-start gap-2 px-4 py-3 text-xs text-(--color-semaglutide)">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {!loading && !error && (
        <ul className="divide-y divide-(--color-panel-border)">
          {sorted.map((b) => (
            <li key={b.scan_name}>
              <BrainItem brain={b} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
