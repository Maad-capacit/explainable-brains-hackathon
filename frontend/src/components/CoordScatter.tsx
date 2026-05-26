import { useEffect, useMemo, useRef } from "react";
import Plotly from "plotly.js-gl3d-dist-min";
import { useStore } from "../store";
import { Panel } from "./Panel";

const COLOR_HIGHLIGHT = "#FFB627";
const COLOR_BG_AXIS = "rgba(255,255,255,0.08)";
const COLOR_FG_AXIS = "#5f5f5f";

function conditionColor(cond: string | undefined): string {
  if (cond === "Semaglutide") return "#E91E63";
  return "#7FE3B5"; // Control / default
}

export function CoordScatter() {
  const selectedScanName = useStore((s) => s.selectedScanName);
  const patches = useStore((s) => s.patches);
  const hoveredPatchIdx = useStore((s) => s.hoveredPatchIdx);
  const setHovered = useStore((s) => s.setHovered);
  const openDetail = useStore((s) => s.openDetail);

  const divRef = useRef<HTMLDivElement | null>(null);

  // Index from patch_idx -> position in patches array (for restyle lookups)
  const patchByIdx = useMemo(() => {
    const m = new Map<number, { x: number; y: number; z: number }>();
    for (const p of patches) m.set(p.patch_idx, { x: p.x0, y: p.y0, z: p.z0 });
    return m;
  }, [patches]);

  // (Re)build the plot when the patch set changes
  useEffect(() => {
    const el = divRef.current;
    if (!el) return;
    if (patches.length === 0) {
      Plotly.purge(el);
      return;
    }

    const condition = patches[0]?.condition;

    const baseTrace = {
      type: "scatter3d",
      mode: "markers",
      x: patches.map((p) => p.x0),
      y: patches.map((p) => p.y0),
      z: patches.map((p) => p.z0),
      customdata: patches.map((p) => p.patch_idx),
      marker: {
        size: 3,
        color: conditionColor(condition),
        opacity: 0.85,
        line: { width: 0 },
      },
      hovertemplate:
        "<b>patch %{customdata}</b><br>x0=%{x}  y0=%{y}  z0=%{z}<extra></extra>",
      name: "patches",
    };

    const highlightTrace = {
      type: "scatter3d",
      mode: "markers",
      x: [] as number[],
      y: [] as number[],
      z: [] as number[],
      marker: {
        size: 9,
        color: COLOR_HIGHLIGHT,
        line: { color: "#000", width: 1 },
      },
      hoverinfo: "skip",
      showlegend: false,
      name: "highlight",
    };

    const layout = {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: "#cccccc", size: 10, family: "Inter, system-ui, sans-serif" },
      margin: { l: 0, r: 0, t: 0, b: 0 },
      showlegend: false,
      scene: {
        bgcolor: "rgba(0,0,0,0)",
        xaxis: { title: { text: "x" }, color: COLOR_FG_AXIS, gridcolor: COLOR_BG_AXIS, zerolinecolor: COLOR_BG_AXIS },
        yaxis: { title: { text: "y" }, color: COLOR_FG_AXIS, gridcolor: COLOR_BG_AXIS, zerolinecolor: COLOR_BG_AXIS },
        zaxis: { title: { text: "z" }, color: COLOR_FG_AXIS, gridcolor: COLOR_BG_AXIS, zerolinecolor: COLOR_BG_AXIS },
        camera: { eye: { x: 1.5, y: 1.5, z: 1.2 } },
        aspectmode: "data" as const,
      },
    };

    const config = { displayModeBar: false, responsive: true };

    Plotly.react(el, [baseTrace, highlightTrace], layout, config).then((plotEl) => {
      plotEl.removeAllListeners("plotly_hover");
      plotEl.removeAllListeners("plotly_unhover");
      plotEl.removeAllListeners("plotly_click");

      plotEl.on("plotly_hover", (ev) => {
        const pt = ev.points[0];
        if (!pt || pt.curveNumber !== 0) return;
        const idx = pt.customdata as number;
        setHovered(idx);
        useStore.getState().scrollToPatchIdx?.(idx);
      });
      plotEl.on("plotly_unhover", () => setHovered(null));
      plotEl.on("plotly_click", (ev) => {
        const pt = ev.points[0];
        if (!pt || pt.curveNumber !== 0) return;
        openDetail(pt.customdata as number);
      });
    });
  }, [patches, setHovered, openDetail]);

  // Update the highlight trace whenever the hovered patch changes (driven by either side).
  useEffect(() => {
    const el = divRef.current;
    if (!el || patches.length === 0) return;
    if (hoveredPatchIdx === null) {
      Plotly.restyle(el, { x: [[]], y: [[]], z: [[]] }, 1);
      return;
    }
    const c = patchByIdx.get(hoveredPatchIdx);
    if (!c) return;
    Plotly.restyle(el, { x: [[c.x]], y: [[c.y]], z: [[c.z]] }, 1);
  }, [hoveredPatchIdx, patchByIdx, patches.length]);

  // Purge on unmount
  useEffect(() => {
    const el = divRef.current;
    return () => {
      if (el) Plotly.purge(el);
    };
  }, []);

  const right = patches.length > 0 ? (
    <span className="font-mono text-[10px] text-(--color-fg-dim)">x · y · z</span>
  ) : null;

  return (
    <Panel title="Coordinates" right={right} bodyClassName="relative">
      {!selectedScanName && (
        <div className="flex h-full items-center justify-center text-xs text-(--color-fg-dim)">
          Select a brain to view coordinates.
        </div>
      )}
      {selectedScanName && <div ref={divRef} className="absolute inset-0" />}
    </Panel>
  );
}
