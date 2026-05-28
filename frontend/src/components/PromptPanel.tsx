import { X, Plus, Trash2, RotateCcw, Play, Loader2 } from "lucide-react";
import { useStore } from "../store";
import { textClusterColor } from "../lib/palette";

export function PromptPanel() {
  const open = useStore((s) => s.promptPanelOpen);
  const algoKey = useStore((s) => s.algoKey);
  const prompts = useStore((s) => s.prompts);
  const setOpen = useStore((s) => s.setPromptPanelOpen);
  const addPrompt = useStore((s) => s.addPrompt);
  const updatePrompt = useStore((s) => s.updatePrompt);
  const removePrompt = useStore((s) => s.removePrompt);
  const resetPrompts = useStore((s) => s.resetPrompts);
  const run = useStore((s) => s.runClusteringForSelected);
  const inProgress = useStore((s) => s.clusteringInProgress);
  const selectedScanName = useStore((s) => s.selectedScanName);

  if (!open || algoKey !== "semantic") return null;

  return (
    <div className="absolute inset-y-0 right-0 z-20 flex w-[340px] max-w-full flex-col rounded-lg border border-(--color-panel-border) bg-(--color-panel) shadow-2xl backdrop-blur-md">
      <header className="flex shrink-0 items-center justify-between border-b border-(--color-panel-border) px-4 py-2.5">
        <h2 className="text-[11px] font-medium tracking-[0.16em] uppercase text-(--color-fg-dim)">
          Prompts · {prompts.length}
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded p-1 text-(--color-fg-dim) transition hover:bg-white/[0.05] hover:text-(--color-fg)"
          title="Close"
        >
          <X size={14} />
        </button>
      </header>

      <p className="shrink-0 px-4 pt-2 text-[10px] leading-relaxed text-(--color-fg-dim)">
        Each prompt becomes one cluster. Patches are assigned to their best-matching
        prompt by PLIP similarity.
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        <div className="flex flex-col gap-1.5">
          {prompts.map((prompt, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: textClusterColor(i) }}
                title={`cluster ${i}`}
              />
              <input
                type="text"
                value={prompt}
                placeholder="describe a cluster…"
                onChange={(e) => updatePrompt(i, e.target.value)}
                className="min-w-0 flex-1 rounded border border-(--color-panel-border) bg-black/40 px-2 py-1 font-mono text-[11px] text-(--color-fg) focus:border-(--color-highlight) focus:outline-none"
              />
              <button
                type="button"
                onClick={() => removePrompt(i)}
                className="shrink-0 rounded p-1 text-(--color-fg-dim) transition hover:bg-white/[0.05] hover:text-(--color-semaglutide)"
                title="Remove prompt"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addPrompt}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded border border-dashed border-(--color-panel-border) px-2 py-1.5 text-[11px] text-(--color-fg-dim) transition hover:border-white/[0.2] hover:text-(--color-fg)"
        >
          <Plus size={12} /> Add prompt
        </button>
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-(--color-panel-border) px-3 py-2">
        <button
          type="button"
          onClick={resetPrompts}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-[11px] text-(--color-fg-dim) transition hover:bg-white/[0.05] hover:text-(--color-fg)"
          title="Reset to default prompts"
        >
          <RotateCcw size={12} /> Reset
        </button>
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
          ) : (
            <>
              <Play size={12} /> Run clustering
            </>
          )}
        </button>
      </footer>
    </div>
  );
}
