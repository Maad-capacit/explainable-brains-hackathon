import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Grid, useGridRef, type CellComponentProps } from "react-window";
import { Loader2 } from "lucide-react";
import { useStore } from "../store";
import { api, type PatchMetadata } from "../lib/api";
import { clusterColor } from "../lib/palette";
import { Panel } from "./Panel";

interface CellProps {
  patches: PatchMetadata[];
  scanName: string;
  columnCount: number;
  clusterByPatchIdx: Map<number, number> | null;
}

function Cell({
  columnIndex,
  rowIndex,
  style,
  patches,
  scanName,
  columnCount,
  clusterByPatchIdx,
}: CellComponentProps<CellProps>) {
  const idx = rowIndex * columnCount + columnIndex;
  const patch = patches[idx];

  const hovered = useStore((s) => s.hoveredPatchIdx === patch?.patch_idx);
  const selected = useStore((s) => s.selectedPatchIdx === patch?.patch_idx);
  const setHovered = useStore((s) => s.setHovered);
  const openDetail = useStore((s) => s.openDetail);

  if (!patch) return null;

  const clusterId = clusterByPatchIdx?.get(patch.patch_idx);
  const stripeColor = clusterId !== undefined ? clusterColor(clusterId) : null;

  const ring = selected
    ? "ring-2 ring-(--color-highlight)"
    : hovered
      ? "ring-1 ring-(--color-highlight)"
      : "ring-1 ring-(--color-panel-border)";

  return (
    <div style={style} className="p-1">
      <button
        type="button"
        onMouseEnter={() => setHovered(patch.patch_idx)}
        onMouseLeave={() => setHovered(null)}
        onClick={() => openDetail(patch.patch_idx)}
        className={
          "group relative block size-full overflow-hidden rounded ring-inset transition-shadow " +
          ring
        }
        aria-label={`patch ${patch.patch_idx}`}
      >
        <img
          src={api.thumbnailURL(scanName, patch.patch_idx)}
          alt=""
          loading="lazy"
          decoding="async"
          className="block size-full object-cover [image-rendering:pixelated]"
        />
        {stripeColor && (
          <span
            className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
            style={{ backgroundColor: stripeColor }}
            title={`cluster ${clusterId}`}
          />
        )}
        <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-black/65 px-1 py-px font-mono text-[9px] text-white/90">
          {patch.patch_idx}
        </span>
        {clusterId !== undefined && (
          <span
            className="pointer-events-none absolute top-1 right-1 rounded bg-black/65 px-1 py-px font-mono text-[9px]"
            style={{ color: stripeColor ?? undefined }}
          >
            c{clusterId}
          </span>
        )}
      </button>
    </div>
  );
}

const TILE_SIZE = 120;

interface GridSurfaceProps {
  /** Override the patches list (e.g. show only one cluster's patches in Phase 2). */
  patchesOverride?: PatchMetadata[];
  /** Pass false to suppress cluster coloring even when a result exists. */
  showClusterColors?: boolean;
  /** When true, registers this grid with the store as the scroll target for CoordScatter hovers. */
  registerScrollTarget?: boolean;
}

/**
 * Bare virtualized patch grid surface — no Panel chrome. Use directly inside a
 * Panel/container that supplies its own header. The Panel-wrapped variant
 * `PatchGrid` is below.
 */
export function PatchGridSurface({
  patchesOverride,
  showClusterColors = true,
  registerScrollTarget = false,
}: GridSurfaceProps = {}) {
  const selectedScanName = useStore((s) => s.selectedScanName);
  const storePatches = useStore((s) => s.patches);
  const loading = useStore((s) => s.patchesLoading);
  const error = useStore((s) => s.patchesError);
  const clusterResult = useStore((s) => s.clusterResult);

  const patches = patchesOverride ?? storePatches;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setSize({ width: r.width, height: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const columnCount = Math.max(1, Math.floor((size.width || TILE_SIZE) / TILE_SIZE));
  const rowCount = Math.ceil(patches.length / columnCount);

  const gridRef = useGridRef(null);

  const clusterByPatchIdx = useMemo<Map<number, number> | null>(() => {
    if (!clusterResult || !showClusterColors) return null;
    const m = new Map<number, number>();
    for (let i = 0; i < clusterResult.labels.length; i++) {
      m.set(i, clusterResult.labels[i]!);
    }
    return m;
  }, [clusterResult, showClusterColors]);

  const positionByIdx = useMemo(() => {
    const m = new Map<number, number>();
    patches.forEach((p, i) => m.set(p.patch_idx, i));
    return m;
  }, [patches]);

  const setScrollToPatchIdx = useStore((s) => s.setScrollToPatchIdx);
  useEffect(() => {
    if (!registerScrollTarget) return;
    setScrollToPatchIdx((patchIdx: number) => {
      const pos = positionByIdx.get(patchIdx);
      if (pos === undefined) return;
      const rowIndex = Math.floor(pos / columnCount);
      const columnIndex = pos % columnCount;
      try {
        gridRef.current?.scrollToCell({
          rowIndex,
          columnIndex,
          rowAlign: "smart",
          columnAlign: "smart",
          behavior: "instant",
        });
      } catch {
        /* transient out-of-range during re-renders */
      }
    });
    return () => setScrollToPatchIdx(null);
  }, [registerScrollTarget, positionByIdx, columnCount, gridRef, setScrollToPatchIdx]);

  const cellProps = useMemo<CellProps>(
    () => ({
      patches,
      scanName: selectedScanName ?? "",
      columnCount,
      clusterByPatchIdx,
    }),
    [patches, selectedScanName, columnCount, clusterByPatchIdx],
  );

  return (
    <div ref={wrapperRef} className="relative h-full w-full">
      {!selectedScanName && (
        <div className="flex h-full items-center justify-center text-xs text-(--color-fg-dim)">
          Select a brain to view patches.
        </div>
      )}
      {selectedScanName && loading && (
        <div className="flex h-full items-center justify-center gap-2 text-xs text-(--color-fg-dim)">
          <Loader2 size={14} className="animate-spin" />
          Loading patches…
        </div>
      )}
      {selectedScanName && error && (
        <div className="flex h-full items-center justify-center px-4 text-xs text-(--color-semaglutide)">
          {error}
        </div>
      )}
      {selectedScanName && !loading && !error && patches.length > 0 && size.width > 0 && (
        <Grid
          gridRef={gridRef}
          cellComponent={Cell}
          cellProps={cellProps}
          columnCount={columnCount}
          rowCount={rowCount}
          columnWidth={TILE_SIZE}
          rowHeight={TILE_SIZE}
          overscanCount={2}
          defaultHeight={size.height}
          defaultWidth={size.width}
          style={{ height: "100%", width: "100%" }}
        />
      )}
    </div>
  );
}

interface PatchGridProps extends GridSurfaceProps {
  title?: string;
  headerRight?: React.ReactNode;
}

/**
 * Panel-wrapped patch grid. Kept for callers that want a self-contained panel
 * (e.g. Phase 2 cluster contents). Phase 1 composes PatchGridSurface inside its
 * own panel layout to share chrome with the config bar.
 */
export function PatchGrid({
  title = "Patches",
  headerRight,
  patchesOverride,
  showClusterColors = true,
  registerScrollTarget,
}: PatchGridProps = {}) {
  const storePatches = useStore((s) => s.patches);
  const patches = patchesOverride ?? storePatches;

  const right =
    headerRight ??
    (patches.length > 0 ? (
      <span className="font-mono text-[10px] text-(--color-fg-dim)">
        {patches.length.toLocaleString()} patches
      </span>
    ) : null);

  return (
    <Panel title={title} right={right} bodyClassName="overflow-hidden">
      <PatchGridSurface
        patchesOverride={patchesOverride}
        showClusterColors={showClusterColors}
        registerScrollTarget={registerScrollTarget}
      />
    </Panel>
  );
}
