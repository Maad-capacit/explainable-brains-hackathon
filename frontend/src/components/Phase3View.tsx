import { ChevronLeft, Sparkles } from "lucide-react";
import { useStore } from "../store";
import { Panel } from "./Panel";

export function Phase3View() {
  const setPhase = useStore((s) => s.setPhase);

  return (
    <Panel
      title="Label · Phase 3"
      bodyClassName="flex flex-col overflow-hidden"
      help="Phase 3 — Label (not yet implemented). The human-in-the-loop labeling step lives here. Reviewers will assign ground-truth labels to representative patches from each cluster, propagate them across the cluster, and export a curated dataset ready for model training."
    >
      <div className="flex flex-1 items-center justify-center px-8">
        <div className="max-w-md text-center">
          <Sparkles className="mx-auto mb-3 text-(--color-highlight)/60" size={32} />
          <h3 className="mb-2 text-sm font-semibold text-(--color-fg)">Phase 3 — Label</h3>
          <p className="text-xs leading-relaxed text-(--color-fg-dim)">
            The human-in-the-loop labeling step lands here. After the user has reviewed
            clusters in Phase 2, this phase will let them confirm or correct cluster
            assignments, write group labels, and export the curated dataset.
          </p>
          <p className="mt-4 font-mono text-[10px] tracking-[0.16em] uppercase text-(--color-fg-dim)/60">
            Coming next
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-start border-t border-(--color-panel-border) px-3 py-2">
        <button
          type="button"
          onClick={() => setPhase(2)}
          className="flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] tracking-wide text-(--color-fg-dim) hover:bg-white/[0.05] hover:text-(--color-fg)"
        >
          <ChevronLeft size={13} />
          Back to Phase 2
        </button>
      </div>
    </Panel>
  );
}
