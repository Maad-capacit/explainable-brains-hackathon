import { useStore } from "../store";
import { Panel } from "./Panel";
import { ClusterConfigBar } from "./ClusterConfigBar";
import { PatchGridSurface } from "./PatchGrid";

export function Phase1View() {
  const patches = useStore((s) => s.patches);
  const clusterResult = useStore((s) => s.clusterResult);

  const right = patches.length > 0 ? (
    <span className="font-mono text-[10px] text-(--color-fg-dim)">
      {patches.length.toLocaleString()} patches
      {clusterResult ? ` · ${Math.max(...Array.from(clusterResult.labels)) + 1} clusters` : ""}
    </span>
  ) : null;

  return (
    <Panel
      title="Patches · Phase 1"
      right={right}
      bodyClassName="flex flex-col overflow-hidden"
      help="Phase 1 — Explore. Browse every patch in the selected brain. Hover a thumbnail to highlight it in the 3D coordinate scatter and the UMAP projection. Click a thumbnail to open the patch detail modal. Pick a clustering algorithm in the bar above and press Run to group the patches into Phase 2 folders."
    >
      <ClusterConfigBar />
      <div className="min-h-0 flex-1">
        <PatchGridSurface registerScrollTarget />
      </div>
    </Panel>
  );
}
