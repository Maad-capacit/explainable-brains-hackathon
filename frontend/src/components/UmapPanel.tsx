import { useEffect, useMemo, useRef } from "react";
import Plotly from "plotly.js-gl3d-dist-min";
import { Loader2 } from "lucide-react";
import { useStore } from "../store";
import { type ProjectionPoint } from "../lib/api";
import { Panel } from "./Panel";

// Matplotlib tab20 — gives 20 visually distinct colors for k=20 clusters.
const TAB20 = [
  "#1f77b4", "#aec7e8", "#ff7f0e", "#ffbb78",
  "#2ca02c", "#98df8a", "#d62728", "#ff9896",
  "#9467bd", "#c5b0d5", "#8c564b", "#c49c94",
  "#e377c2", "#f7b6d2", "#7f7f7f", "#c7c7c7",
  "#bcbd22", "#dbdb8d", "#17becf", "#9edae5",
];


export function UmapPanel() {
  const projection = useStore((s) => s.projection);
  const loading = useStore((s) => s.projectionLoading);
  const error = useStore((s) => s.projectionError);
  const loadProjection = useStore((s) => s.loadProjection);
  const setHoveredProjectionPoint = useStore((s) => s.setHoveredProjectionPoint);

  const divRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadProjection();
  }, [loadProjection]);

  // Group points by cluster so each becomes its own plotly trace (one color per trace).
  const traces = useMemo(() => {
    if (projection.length === 0) return [];
    const buckets = new Map<number, ProjectionPoint[]>();
    for (const p of projection) {
      const arr = buckets.get(p.cluster_id);
      if (arr) arr.push(p);
      else buckets.set(p.cluster_id, [p]);
    }
    return [...buckets.entries()]
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
          color: TAB20[cluster_id % TAB20.length],
          opacity: 0.8,
          line: { width: 0 },
        },
        hovertemplate: "cluster %{customdata[2]} — patch %{customdata[0]}<extra></extra>",
      }));
  }, [projection]);

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

  const right = projection.length > 0 ? (
    <span className="font-mono text-[10px] text-(--color-fg-dim)">
      {projection.length} pts · k=20
    </span>
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
