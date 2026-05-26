import { useEffect, useMemo, useRef, useState } from "react";
import Plotly from "plotly.js-gl3d-dist-min";
import { Loader2, Globe2, Focus } from "lucide-react";
import { useStore } from "../store";
import { type ProjectionPoint } from "../lib/api";
import { clusterColor } from "../lib/palette";
import { Panel } from "./Panel";

type ViewMode = "global" | "local";
type ColorMode = "kmeans" | "text";

// 24-color palette for text clusters (4 more than tab20 since the PLIP vocab
// has 24 phrases). The first 20 match `clusterColor` so kmeans and text modes
// share colors for the overlapping ids.
const TEXT_PALETTE = [
  "#1f77b4", "#aec7e8", "#ff7f0e", "#ffbb78",
  "#2ca02c", "#98df8a", "#d62728", "#ff9896",
  "#9467bd", "#c5b0d5", "#8c564b", "#c49c94",
  "#e377c2", "#f7b6d2", "#7f7f7f", "#c7c7c7",
  "#bcbd22", "#dbdb8d", "#17becf", "#9edae5",
  "#393b79", "#637939", "#8c6d31", "#843c39",
];

export function UmapPanel() {
  const projection = useStore((s) => s.projection);
  const textLabels = useStore((s) => s.textLabels);
  const loading = useStore((s) => s.projectionLoading);
  const error = useStore((s) => s.projectionError);
  const loadProjection = useStore((s) => s.loadProjection);
  const setHoveredProjectionPoint = useStore((s) => s.setHoveredProjectionPoint);

  const selectedScanName = useStore((s) => s.selectedScanName);
  const clusterResult = useStore((s) => s.clusterResult);

  const divRef = useRef<HTMLDivElement | null>(null);
  const [colorMode, setColorMode] = useState<ColorMode>("kmeans");

  useEffect(() => {
    loadProjection();
  }, [loadProjection]);

  // Auto-switch to the local view as soon as a per-brain clustering exists. The
  // user can flip back to global with the toggle in the header.
  const hasLocal = clusterResult !== null && selectedScanName !== null;
  const haveText = textLabels.length > 0;
  const [override, setOverride] = useState<ViewMode | null>(null);
  const effectiveMode: ViewMode = override ?? (hasLocal ? "local" : "global");

  // Reset the override whenever the brain changes — switching brains should
  // again default to "local view if you've clustered, global otherwise".
  useEffect(() => {
    setOverride(null);
  }, [selectedScanName, clusterResult]);

  // Build plotly traces.
  // Local  mode → only the selected brain's points, one trace per local cluster id.
  // Global mode → one trace per cluster, colored by kmeans cluster_id or PLIP text_cluster_id.
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
          customdata: pts.map((p) => [p.patch_idx, p.scan_name, cluster_id, p.text_cluster_id]),
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

    // Global mode. Color by either kmeans cluster_id or PLIP text_cluster_id.
    const keyOf = (p: ProjectionPoint) =>
      colorMode === "kmeans" ? p.cluster_id : p.text_cluster_id;

    const buckets = new Map<number, ProjectionPoint[]>();
    for (const p of projection) {
      const key = keyOf(p);
      const arr = buckets.get(key);
      if (arr) arr.push(p);
      else buckets.set(key, [p]);
    }
    const built = [...buckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([id, pts]) => {
        const label =
          colorMode === "kmeans"
            ? `cluster ${id}`
            : (textLabels[id] ?? `cluster ${id}`);
        // Trim text-mode legend labels — long phrases blow out hover text.
        const trimmed = label.length > 50 ? label.slice(0, 47) + "…" : label;
        const color =
          colorMode === "kmeans" ? clusterColor(id) : TEXT_PALETTE[id % TEXT_PALETTE.length];
        return {
          type: "scattergl",
          mode: "markers",
          name: trimmed,
          x: pts.map((p) => p.x),
          y: pts.map((p) => p.y),
          customdata: pts.map((p) => [p.patch_idx, p.scan_name, p.cluster_id, p.text_cluster_id]),
          marker: {
            size: 5,
            color,
            // Dim points belonging to other brains when we have a selection,
            // so the focused brain reads against the global background.
            opacity: selectedScanName === null ? 0.8 : 0.25,
            line: { width: 0 },
          },
          hovertemplate: `${trimmed} — patch %{customdata[0]}<extra></extra>`,
        };
      });

    // If a brain is selected, overlay its points at full opacity on top.
    if (selectedScanName !== null) {
      const focusedByKey = new Map<number, ProjectionPoint[]>();
      for (const p of projection) {
        if (p.scan_name !== selectedScanName) continue;
        const key = keyOf(p);
        const arr = focusedByKey.get(key);
        if (arr) arr.push(p);
        else focusedByKey.set(key, [p]);
      }
      for (const [id, pts] of focusedByKey) {
        const label =
          colorMode === "kmeans"
            ? `cluster ${id}`
            : (textLabels[id] ?? `cluster ${id}`);
        const trimmed = label.length > 50 ? label.slice(0, 47) + "…" : label;
        const color =
          colorMode === "kmeans" ? clusterColor(id) : TEXT_PALETTE[id % TEXT_PALETTE.length];
        built.push({
          type: "scattergl",
          mode: "markers",
          name: `selected ${trimmed}`,
          x: pts.map((p) => p.x),
          y: pts.map((p) => p.y),
          customdata: pts.map((p) => [p.patch_idx, p.scan_name, p.cluster_id, p.text_cluster_id]),
          marker: {
            size: 7,
            color,
            opacity: 0.95,
            line: { width: 0.5, color: "#000" } as unknown as { width: number },
          },
          hovertemplate: `${trimmed} — patch %{customdata[0]}<extra></extra>`,
        });
      }
    }
    return { traces: built, k: buckets.size };
  }, [projection, effectiveMode, hasLocal, clusterResult, selectedScanName, colorMode, textLabels]);

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
        const [patch_idx, scan_name, cluster_id, text_cluster_id] =
          pt.customdata as [number, string, number, number];
        const point: ProjectionPoint = {
          patch_idx,
          scan_name,
          cluster_id,
          text_cluster_id,
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
      {effectiveMode === "global" && haveText && (
        <div className="flex overflow-hidden rounded border border-(--color-panel-border) text-[10px]">
          <button
            type="button"
            onClick={() => setColorMode("kmeans")}
            className={
              "px-2 py-0.5 transition-colors " +
              (colorMode === "kmeans"
                ? "bg-white/10 text-(--color-fg)"
                : "text-(--color-fg-dim) hover:bg-white/[0.03]")
            }
          >
            K-means
          </button>
          <button
            type="button"
            onClick={() => setColorMode("text")}
            className={
              "px-2 py-0.5 transition-colors " +
              (colorMode === "text"
                ? "bg-white/10 text-(--color-fg)"
                : "text-(--color-fg-dim) hover:bg-white/[0.03]")
            }
          >
            Text vocab
          </button>
        </div>
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
