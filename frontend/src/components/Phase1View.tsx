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
    <Panel title="Patches · Phase 1" right={right} bodyClassName="flex flex-col overflow-hidden">
      <ClusterConfigBar />
      <div className="min-h-0 flex-1">
        <PatchGridSurface registerScrollTarget />
      </div>
    </Panel>
  );
}
