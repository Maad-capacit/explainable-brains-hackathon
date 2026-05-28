import { useMemo } from "react";
import { ChevronLeft, ChevronRight, RotateCcw, FolderOpen, Folder } from "lucide-react";
import { useStore } from "../store";
import { ALGORITHMS } from "../lib/clustering";
import { clusterColor, textClusterColor } from "../lib/palette";
import { Panel } from "./Panel";
import { PatchGridSurface } from "./PatchGrid";

interface ClusterSummary {
  cluster_id: number;
  size: number;
}

export function Phase2View() {
  const patches = useStore((s) => s.patches);
  const result = useStore((s) => s.clusterResult);
  const selectedCluster = useStore((s) => s.selectedCluster);
  const setSelectedCluster = useStore((s) => s.setSelectedCluster);
  const setPhase = useStore((s) => s.setPhase);
  const runClustering = useStore((s) => s.runClusteringForSelected);
  const inProgress = useStore((s) => s.clusteringInProgress);

  const summaries: ClusterSummary[] = useMemo(() => {
    if (!result) return [];
    const counts = new Map<number, number>();
    for (let i = 0; i < result.labels.length; i++) {
      const c = result.labels[i]!;
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([cluster_id, size]) => ({ cluster_id, size }))
      .sort((a, b) => a.cluster_id - b.cluster_id);
  }, [result]);

  const clusterPatches = useMemo(() => {
    if (!result || selectedCluster === null) return [];
    return patches.filter((p) => result.labels[p.patch_idx] === selectedCluster);
  }, [patches, result, selectedCluster]);

  // Semantic clusters carry per-cluster prompt text and use the 24-color text
  // palette so folders match the UMAP "Text vocab" coloring.
  const isSemantic = result?.algorithmKey === "semantic";
  const colorFor = (id: number) => (isSemantic ? textClusterColor(id) : clusterColor(id));
  const labelFor = (id: number) => result?.clusterLabels?.[id]?.trim() || `c${id}`;

  const right = result ? (
    <span className="font-mono text-[10px] text-(--color-fg-dim)">
      {summaries.length} clusters · {ALGORITHMS[result.algorithmKey].label}
    </span>
  ) : null;

  return (
    <Panel title="Clusters · Phase 2" right={right} bodyClassName="flex flex-col overflow-hidden">
      {!result ? (
        <div className="flex h-full items-center justify-center px-8 text-center text-xs text-(--color-fg-dim)">
          Run a clustering algorithm in <span className="mx-1 font-semibold text-(--color-fg)">Phase 1</span> to
          populate cluster sub-folders here.
        </div>
      ) : (
        <>
          {/* Cluster folder strip */}
          <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-(--color-panel-border) px-3 py-2">
            <span className="shrink-0 text-[10px] tracking-[0.16em] uppercase text-(--color-fg-dim)">Folders</span>
            <div className="flex shrink-0 items-center gap-1.5">
              {summaries.map((s) => {
                const active = selectedCluster === s.cluster_id;
                const color = colorFor(s.cluster_id);
                const label = labelFor(s.cluster_id);
                const shortLabel = isSemantic && label.length > 22 ? label.slice(0, 21) + "…" : label;
                const Icon = active ? FolderOpen : Folder;
                return (
                  <button
                    key={s.cluster_id}
                    type="button"
                    onClick={() => setSelectedCluster(active ? null : s.cluster_id)}
                    className={
                      "flex shrink-0 items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-[11px] tabular-nums transition " +
                      (active
                        ? "border-(--color-highlight) bg-(--color-highlight)/10 text-(--color-fg)"
                        : "border-(--color-panel-border) bg-black/30 text-(--color-fg)/85 hover:border-white/[0.15]")
                    }
                    title={`${label} — ${s.size} patches`}
                  >
                    <Icon size={12} style={{ color }} />
                    <span style={{ color }}>{shortLabel}</span>
                    <span className="text-(--color-fg-dim)">{s.size}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cluster contents */}
          <div className="min-h-0 flex-1">
            {selectedCluster === null ? (
              <div className="flex h-full items-center justify-center px-8 text-center text-xs text-(--color-fg-dim)">
                Pick a cluster above to inspect its patches.
              </div>
            ) : (
              <div className="flex h-full flex-col">
                <div className="flex shrink-0 items-center justify-between border-b border-(--color-panel-border) px-3 py-1.5">
                  <span className="flex items-center gap-2 font-mono text-[11px]">
                    <span
                      className="inline-block size-2 rounded-full"
                      style={{ backgroundColor: colorFor(selectedCluster) }}
                    />
                    {labelFor(selectedCluster)}
                  </span>
                  <span className="font-mono text-[10px] text-(--color-fg-dim)">
                    {clusterPatches.length} patches · {((clusterPatches.length / patches.length) * 100).toFixed(1)}% of brain
                  </span>
                </div>
                <div className="min-h-0 flex-1">
                  <PatchGridSurface
                    patchesOverride={clusterPatches}
                    showClusterColors={false}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-(--color-panel-border) px-3 py-2">
            <button
              type="button"
              onClick={() => setPhase(1)}
              className="flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] tracking-wide text-(--color-fg-dim) hover:bg-white/[0.05] hover:text-(--color-fg)"
            >
              <ChevronLeft size={13} />
              Back to Phase 1
            </button>
            <button
              type="button"
              onClick={() => runClustering()}
              disabled={inProgress}
              className="flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] tracking-wide text-(--color-fg-dim) hover:bg-white/[0.05] hover:text-(--color-fg) disabled:opacity-40"
              title="Re-run clustering with current configuration"
            >
              <RotateCcw size={13} />
              Re-run clustering
            </button>
            <button
              type="button"
              onClick={() => setPhase(3)}
              className="flex items-center gap-1.5 rounded bg-(--color-highlight)/10 px-2.5 py-1 text-[11px] tracking-wide text-(--color-highlight) hover:bg-(--color-highlight)/20"
            >
              Phase 3
              <ChevronRight size={13} />
            </button>
          </div>
        </>
      )}
    </Panel>
  );
}
