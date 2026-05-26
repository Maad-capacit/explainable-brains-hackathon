import { useEffect, useMemo, useRef, useState } from "react";
import Plotly from "plotly.js-gl3d-dist-min";
import { Loader2 } from "lucide-react";
import { useStore } from "../store";
import { type ProjectionPoint } from "../lib/api";
import { Panel } from "./Panel";

// 24-color palette for text clusters; first 20 also serve k-means coloring.
const PALETTE = [
  "#1f77b4", "#aec7e8", "#ff7f0e", "#ffbb78",
  "#2ca02c", "#98df8a", "#d62728", "#ff9896",
  "#9467bd", "#c5b0d5", "#8c564b", "#c49c94",
  "#e377c2", "#f7b6d2", "#7f7f7f", "#c7c7c7",
  "#bcbd22", "#dbdb8d", "#17becf", "#9edae5",
  "#393b79", "#637939", "#8c6d31", "#843c39",
];

type Mode = "kmeans" | "text";

export function UmapPanel() {
  const projection = useStore((s) => s.projection);
  const textLabels = useStore((s) => s.textLabels);
  const loading = useStore((s) => s.projectionLoading);
  const error = useStore((s) => s.projectionError);
  const loadProjection = useStore((s) => s.loadProjection);
  const setHoveredProjectionPoint = useStore((s) => s.setHoveredProjectionPoint);

  const divRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<Mode>("kmeans");

  useEffect(() => {
    loadProjection();
  }, [loadProjection]);

  const haveText = textLabels.length > 0;

  // Group points by cluster id for the active mode; one trace per cluster so
  // plotly's legend gives free click-to-filter behaviour.
  const traces = useMemo(() => {
    if (projection.length === 0) return [];
    const keyOf = (p: ProjectionPoint) =>
      mode === "kmeans" ? p.cluster_id : p.text_cluster_id;

    const buckets = new Map<number, ProjectionPoint[]>();
    for (const p of projection) {
      const k = keyOf(p);
      const arr = buckets.get(k);
      if (arr) arr.push(p);
      else buckets.set(k, [p]);
    }
    return [...buckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([id, pts]) => {
        const label =
          mode === "kmeans"
            ? `cluster ${id}`
            : (textLabels[id] ?? `cluster ${id}`);
        // Trim text-mode legend labels — long phrases blow out the legend.
        const trimmed = label.length > 50 ? label.slice(0, 47) + "…" : label;
        return {
          type: "scattergl",
          mode: "markers",
          name: trimmed,
          x: pts.map((p) => p.x),
          y: pts.map((p) => p.y),
          customdata: pts.map((p) => [
            p.patch_idx,
            p.scan_name,
            p.cluster_id,
            p.text_cluster_id,
          ]),
          marker: {
            size: 5,
            color: PALETTE[id % PALETTE.length],
            opacity: 0.8,
            line: { width: 0 },
          },
          hovertemplate: `${trimmed} — patch %{customdata[0]}<extra></extra>`,
        };
      });
  }, [projection, mode, textLabels]);

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
  }, [traces, mode, setHoveredProjectionPoint]);

  // Cleanup on unmount.
  useEffect(() => {
    const el = divRef.current;
    return () => {
      if (el) Plotly.purge(el);
    };
  }, []);

  const right = projection.length > 0 ? (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[10px] text-(--color-fg-dim)">
        {projection.length} pts
      </span>
      <div className="flex overflow-hidden rounded border border-(--color-panel-border) text-[10px]">
        <button
          type="button"
          onClick={() => setMode("kmeans")}
          className={
            "px-2 py-0.5 transition-colors " +
            (mode === "kmeans"
              ? "bg-white/10 text-(--color-fg)"
              : "text-(--color-fg-dim) hover:bg-white/[0.03]")
          }
        >
          K-means
        </button>
        <button
          type="button"
          onClick={() => setMode("text")}
          disabled={!haveText}
          title={haveText ? "" : "No text clusters available"}
          className={
            "px-2 py-0.5 transition-colors " +
            (mode === "text"
              ? "bg-white/10 text-(--color-fg)"
              : "text-(--color-fg-dim) hover:bg-white/[0.03] disabled:opacity-40")
          }
        >
          Text vocab
        </button>
      </div>
    </div>
  ) : null;

  return (
    <Panel title="UMAP clusters" right={right} bodyClassName="relative">
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
