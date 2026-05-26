import { useEffect, useMemo, useRef, useState } from "react";
import Plotly from "plotly.js-gl3d-dist-min";
import { Loader2, Globe2, Focus } from "lucide-react";
import { useStore } from "../store";
import { type ProjectionPoint } from "../lib/api";
import { clusterColor } from "../lib/palette";
import { Panel } from "./Panel";

type ViewMode = "global" | "local";

export function UmapPanel() {
  const projection = useStore((s) => s.projection);
  const loading = useStore((s) => s.projectionLoading);
  const error = useStore((s) => s.projectionError);
  const loadProjection = useStore((s) => s.loadProjection);
  const setHoveredProjectionPoint = useStore((s) => s.setHoveredProjectionPoint);

  const selectedScanName = useStore((s) => s.selectedScanName);
  const clusterResult = useStore((s) => s.clusterResult);

  const divRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadProjection();
  }, [loadProjection]);

  // Auto-switch to the local view as soon as a per-brain clustering exists. The
  // user can flip back to global with the toggle in the header.
  const hasLocal = clusterResult !== null && selectedScanName !== null;
  const [override, setOverride] = useState<ViewMode | null>(null);
  const effectiveMode: ViewMode = override ?? (hasLocal ? "local" : "global");

  // Reset the override whenever the brain changes — switching brains should
  // again default to "local view if you've clustered, global otherwise".
  useEffect(() => {
    setOverride(null);
  }, [selectedScanName, clusterResult]);

  // Build plotly traces.
  // Global mode → one trace per global cluster_id (Maad's offline k=20 clustering).
  // Local  mode → only the selected brain's points, one trace per local cluster id.
  const { traces, k } = useMemo(() => {
    if (projection.length === 0) return { traces: [], k: 0 };

    if (effectiveMode === "local" && hasLocal && clusterResult && selectedScanName) {
      const labels = clusterResult.labels;
      const buckets = new Map<number, ProjectionPoint[]>();
      for (const p of projection) {
        if (p.scan_name !== selectedScanName) continue;
        const localCid = labels[p.patch_idx];
        if (localCid === undefined) continue;
        const arr = buckets.get(localCid);
        if (arr) arr.push(p);
        else buckets.set(localCid, [p]);
      }
      const built = [...buckets.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([cluster_id, pts]) => ({
          type: "scattergl",
          mode: "markers",
          name: `local cluster ${cluster_id}`,
          x: pts.map((p) => p.x),
          y: pts.map((p) => p.y),
          customdata: pts.map((p) => [p.patch_idx, p.scan_name, cluster_id]),
          marker: {
            size: 7,
            color: clusterColor(cluster_id),
            opacity: 0.9,
            line: { width: 0 },
          },
          hovertemplate: "local cluster %{customdata[2]} — patch %{customdata[0]}<extra></extra>",
        }));
      return { traces: built, k: buckets.size };
    }

    // Global mode (no local clustering, or override). Color by Maad's global cluster_id.
    const buckets = new Map<number, ProjectionPoint[]>();
    for (const p of projection) {
      const arr = buckets.get(p.cluster_id);
      if (arr) arr.push(p);
      else buckets.set(p.cluster_id, [p]);
    }
    const built = [...buckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([cluster_id, pts]) => ({
        type: "scattergl",
        mode: "markers",
        name: `cluster ${cluster_id}`,
        x: pts.map((p) => p.x),
        y: pts.map((p) => p.y),
        customdata: pts.map((p) => [p.patch_idx, p.scan_name, p.cluster_id]),
        marker: {
          size: 5,
          color: clusterColor(cluster_id),
          // Dim points belonging to other brains when we have a selection,
          // so the focused brain reads against the global background.
          opacity: selectedScanName === null ? 0.8 : 0.25,
          line: { width: 0 },
        },
        hovertemplate: "cluster %{customdata[2]} — patch %{customdata[0]}<extra></extra>",
      }));

    // If a brain is selected, overlay its points at full opacity on top.
    if (selectedScanName !== null) {
      const focusedByCluster = new Map<number, ProjectionPoint[]>();
      for (const p of projection) {
        if (p.scan_name !== selectedScanName) continue;
        const arr = focusedByCluster.get(p.cluster_id);
        if (arr) arr.push(p);
        else focusedByCluster.set(p.cluster_id, [p]);
      }
      for (const [cluster_id, pts] of focusedByCluster) {
        built.push({
          type: "scattergl",
          mode: "markers",
          name: `selected cluster ${cluster_id}`,
          x: pts.map((p) => p.x),
          y: pts.map((p) => p.y),
          customdata: pts.map((p) => [p.patch_idx, p.scan_name, p.cluster_id]),
          marker: {
            size: 7,
            color: clusterColor(cluster_id),
            opacity: 0.95,
            line: { width: 0.5, color: "#000" } as unknown as { width: number },
          },
          hovertemplate: "cluster %{customdata[2]} — patch %{customdata[0]}<extra></extra>",
        });
      }
    }
    return { traces: built, k: buckets.size };
  }, [projection, effectiveMode, hasLocal, clusterResult, selectedScanName]);

  // Render plot.
  useEffect(() => {
    const el = divRef.current;
    if (!el) return;
    if (traces.length === 0) {
      Plotly.purge(el);
      return;
    }

    const layout = {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: "#cccccc", size: 10, family: "Inter, system-ui, sans-serif" },
      margin: { l: 30, r: 10, t: 10, b: 30 },
      showlegend: false,
      xaxis: { title: { text: "UMAP 1" }, color: "#5f5f5f", gridcolor: "rgba(255,255,255,0.08)", zerolinecolor: "rgba(255,255,255,0.08)" },
      yaxis: { title: { text: "UMAP 2" }, color: "#5f5f5f", gridcolor: "rgba(255,255,255,0.08)", zerolinecolor: "rgba(255,255,255,0.08)", scaleanchor: "x" as const, scaleratio: 1 },
      hovermode: "closest" as const,
      dragmode: "pan" as const,
    };

    const config = { displayModeBar: false, responsive: true };

    Plotly.react(el, traces, layout, config).then((plotEl) => {
      plotEl.removeAllListeners("plotly_hover");
      plotEl.removeAllListeners("plotly_unhover");

      plotEl.on("plotly_hover", (ev) => {
        const pt = ev.points[0];
        if (!pt) return;
        const [patch_idx, scan_name, cluster_id] = pt.customdata as [number, string, number];
        const point: ProjectionPoint = {
          patch_idx,
          scan_name,
          cluster_id,
          x: pt.x as number,
          y: pt.y as number,
          group_nr: "",
        };
        setHoveredProjectionPoint(point);
      });
      plotEl.on("plotly_unhover", () => setHoveredProjectionPoint(null));
    });
  }, [traces, setHoveredProjectionPoint]);

  // Cleanup on unmount.
  useEffect(() => {
    const el = divRef.current;
    return () => {
      if (el) Plotly.purge(el);
    };
  }, []);

  const headerRight = (
    <div className="flex items-center gap-2">
      {projection.length > 0 && (
        <span className="font-mono text-[10px] text-(--color-fg-dim)">
          {effectiveMode === "local"
            ? `${clusterResult?.labels.length ?? 0} pts · k=${k}`
            : `${projection.length} pts · k=${k}`}
        </span>
      )}
      {hasLocal && (
        <div className="flex items-center gap-px rounded border border-(--color-panel-border) bg-black/40 p-0.5">
          <button
            type="button"
            onClick={() => setOverride("local")}
            title="Show only the selected brain, colored by your clustering"
            className={
              "flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] transition " +
              (effectiveMode === "local"
                ? "bg-(--color-highlight)/15 text-(--color-highlight)"
                : "text-(--color-fg-dim) hover:text-(--color-fg)")
            }
          >
            <Focus size={10} /> local
          </button>
          <button
            type="button"
            onClick={() => setOverride("global")}
            title="Show all 12 brains, colored by Maad's offline clustering"
            className={
              "flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] transition " +
              (effectiveMode === "global"
                ? "bg-(--color-highlight)/15 text-(--color-highlight)"
                : "text-(--color-fg-dim) hover:text-(--color-fg)")
            }
          >
            <Globe2 size={10} /> all
          </button>
        </div>
      )}
    </div>
  );

  const title =
    effectiveMode === "local" && hasLocal
      ? "UMAP · your clusters"
      : selectedScanName
        ? "UMAP · all patches (brain highlighted)"
        : "UMAP · all patches";

  return (
    <Panel title={title} right={headerRight} bodyClassName="relative">
      {loading && (
        <div className="flex h-full items-center justify-center gap-2 text-xs text-(--color-fg-dim)">
          <Loader2 size={14} className="animate-spin" />
          Loading projection…
        </div>
      )}
      {error && (
        <div className="flex h-full items-center justify-center px-4 text-xs text-(--color-semaglutide)">
          {error}
        </div>
      )}
      {!loading && !error && projection.length > 0 && (
        <div className="absolute inset-0">
          <div ref={divRef} className="absolute inset-0" />
        </div>
      )}
    </Panel>
  );
}
