import { useStore, type Phase } from "../store";
import { ALGORITHMS } from "../lib/clustering";
import { CheckCircle2, Circle, Lock } from "lucide-react";

interface TabDef {
  phase: Phase;
  label: string;
  hint: string;
}

const TABS: TabDef[] = [
  { phase: 1, label: "1 · Explore", hint: "All patches + run a clustering algorithm" },
  { phase: 2, label: "2 · Review clusters", hint: "Walk through clusters and inspect contents" },
  { phase: 3, label: "3 · Label", hint: "Coming next" },
];

export function PhaseTabs() {
  const currentPhase = useStore((s) => s.currentPhase);
  const setPhase = useStore((s) => s.setPhase);
  const clusterResult = useStore((s) => s.clusterResult);
  const selectedScanName = useStore((s) => s.selectedScanName);

  const isUnlocked = (phase: Phase): boolean => {
    if (!selectedScanName) return false;
    if (phase === 1) return true;
    return clusterResult !== null; // phases 2 & 3 need a clustering result first
  };

  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-(--color-panel-border) bg-(--color-panel)/60 px-2 py-1.5 backdrop-blur-sm">
      {TABS.map((t) => {
        const active = currentPhase === t.phase;
        const unlocked = isUnlocked(t.phase);
        const Icon =
          t.phase === 1 || (t.phase === 2 && clusterResult)
            ? CheckCircle2
            : unlocked
              ? Circle
              : Lock;
        return (
          <button
            key={t.phase}
            type="button"
            disabled={!unlocked}
            onClick={() => setPhase(t.phase)}
            title={t.hint}
            className={
              "group flex items-center gap-2 rounded px-3 py-1.5 text-[12px] tracking-wide transition " +
              (active
                ? "bg-(--color-highlight)/15 text-(--color-highlight)"
                : unlocked
                  ? "text-(--color-fg-dim) hover:bg-white/[0.04] hover:text-(--color-fg)"
                  : "text-(--color-fg-dim)/40 cursor-not-allowed")
            }
          >
            <Icon size={13} />
            <span>{t.label}</span>
          </button>
        );
      })}
      <div className="flex-1" />
      {clusterResult && (
        <span className="font-mono text-[10px] text-(--color-fg-dim)">
          {ALGORITHMS[clusterResult.algorithmKey].label} · k=
          {Math.max(...Array.from(clusterResult.labels)) + 1} ·{" "}
          {clusterResult.durationMs.toFixed(0)}ms
        </span>
      )}
    </div>
  );
}
