import { Play, Loader2, RotateCcw, AlertCircle, SlidersHorizontal } from "lucide-react";
import { useStore } from "../store";
import { ALGORITHMS, type AlgoKey, type ParamSpec } from "../lib/clustering";

function NumberInput({ spec, value, onChange }: { spec: ParamSpec; value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : ""}
      min={spec.min}
      max={spec.max}
      step={spec.step ?? (spec.type === "int" ? 1 : 0.01)}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") return;
        const n = spec.type === "int" ? parseInt(raw, 10) : parseFloat(raw);
        if (Number.isFinite(n)) onChange(n);
      }}
      className="w-16 rounded border border-(--color-panel-border) bg-black/40 px-2 py-1 text-right font-mono text-[11px] tabular-nums text-(--color-fg) focus:border-(--color-highlight) focus:outline-none"
    />
  );
}

function SelectInput({ spec, value, onChange }: { spec: ParamSpec; value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded border border-(--color-panel-border) bg-black/40 px-2 py-1 font-mono text-[11px] text-(--color-fg) focus:border-(--color-highlight) focus:outline-none"
    >
      {spec.options?.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function ClusterConfigBar() {
  const algoKey = useStore((s) => s.algoKey);
  const algoParams = useStore((s) => s.algoParams);
  const setAlgorithm = useStore((s) => s.setAlgorithm);
  const setAlgoParam = useStore((s) => s.setAlgoParam);
  const resetAlgoParams = useStore((s) => s.resetAlgoParams);
  const run = useStore((s) => s.runClusteringForSelected);
  const inProgress = useStore((s) => s.clusteringInProgress);
  const error = useStore((s) => s.clusteringError);
  const result = useStore((s) => s.clusterResult);
  const selectedScanName = useStore((s) => s.selectedScanName);
  const prompts = useStore((s) => s.prompts);
  const promptPanelOpen = useStore((s) => s.promptPanelOpen);
  const setPromptPanelOpen = useStore((s) => s.setPromptPanelOpen);

  const algo = ALGORITHMS[algoKey];
  const allAlgos = Object.values(ALGORITHMS);

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-(--color-panel-border) bg-(--color-panel)/40 px-3 py-2 backdrop-blur-sm">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] tracking-[0.16em] uppercase text-(--color-fg-dim)">Algorithm</span>
        <select
          value={algoKey}
          onChange={(e) => setAlgorithm(e.target.value as AlgoKey)}
          className="rounded border border-(--color-panel-border) bg-black/40 px-2 py-1 font-mono text-[11px] text-(--color-fg) focus:border-(--color-highlight) focus:outline-none"
        >
          {allAlgos.map((a) => (
            <option key={a.key} value={a.key}>{a.label}</option>
          ))}
        </select>
      </div>

      <div className="h-4 w-px bg-(--color-panel-border)" aria-hidden="true" />

      {algo.usesPrompts ? (
        <button
          type="button"
          onClick={() => setPromptPanelOpen(!promptPanelOpen)}
          title="Edit the prompts that define the clusters"
          className={
            "flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-[11px] transition " +
            (promptPanelOpen
              ? "border-(--color-highlight) bg-(--color-highlight)/10 text-(--color-fg)"
              : "border-(--color-panel-border) bg-black/40 text-(--color-fg) hover:border-white/[0.15]")
          }
        >
          <SlidersHorizontal size={12} />
          Prompts ({prompts.length})
        </button>
      ) : (
        <>
          {algo.params.map((spec) => {
            const value = algoParams[spec.key];
            return (
              <label key={spec.key} className="flex items-center gap-1.5" title={spec.description ?? ""}>
                <span className="font-mono text-[10px] text-(--color-fg-dim)">{spec.label}</span>
                {spec.type === "select" ? (
                  <SelectInput spec={spec} value={String(value)} onChange={(v) => setAlgoParam(spec.key, v)} />
                ) : (
                  <NumberInput spec={spec} value={Number(value)} onChange={(v) => setAlgoParam(spec.key, v)} />
                )}
              </label>
            );
          })}

          <button
            type="button"
            onClick={resetAlgoParams}
            title="Reset to defaults"
            className="flex items-center gap-1 rounded p-1 text-(--color-fg-dim) transition hover:bg-white/[0.05] hover:text-(--color-fg)"
          >
            <RotateCcw size={12} />
          </button>
        </>
      )}

      <div className="flex-1" />

      {error && (
        <span className="flex items-center gap-1 text-[11px] text-(--color-semaglutide)">
          <AlertCircle size={12} />
          {error}
        </span>
      )}

      <button
        type="button"
        onClick={() => run()}
        disabled={inProgress || !selectedScanName}
        className={
          "flex items-center gap-1.5 rounded px-3 py-1.5 text-[11px] font-medium tracking-wide transition " +
          (inProgress
            ? "bg-(--color-highlight)/20 text-(--color-highlight) cursor-wait"
            : "bg-(--color-highlight)/10 text-(--color-highlight) hover:bg-(--color-highlight)/20 disabled:opacity-40 disabled:cursor-not-allowed")
        }
      >
        {inProgress ? (
          <>
            <Loader2 size={12} className="animate-spin" /> Running…
          </>
        ) : result ? (
          <>
            <Play size={12} /> Re-run
          </>
        ) : (
          <>
            <Play size={12} /> Run clustering
          </>
        )}
      </button>
    </div>
  );
}
