import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Grid, useGridRef, type CellComponentProps } from "react-window";
import { Loader2 } from "lucide-react";
import { useStore } from "../store";
import { api, type PatchMetadata } from "../lib/api";
import { Panel } from "./Panel";

interface CellProps {
  patches: PatchMetadata[];
  scanName: string;
  columnCount: number;
  tileSize: number;
}

function Cell({
  columnIndex,
  rowIndex,
  style,
  patches,
  scanName,
  columnCount,
}: CellComponentProps<CellProps>) {
  const idx = rowIndex * columnCount + columnIndex;
  const patch = patches[idx];

  const hovered = useStore((s) => s.hoveredPatchIdx === patch?.patch_idx);
  const selected = useStore((s) => s.selectedPatchIdx === patch?.patch_idx);
  const setHovered = useStore((s) => s.setHovered);
  const openDetail = useStore((s) => s.openDetail);

  if (!patch) return null;

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
        <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-black/65 px-1 py-px font-mono text-[9px] text-white/90">
          {patch.patch_idx}
        </span>
      </button>
    </div>
  );
}

const TILE_SIZE = 120; // px, square thumb tile

export function PatchGrid() {
  const selectedScanName = useStore((s) => s.selectedScanName);
  const patches = useStore((s) => s.patches);
  const loading = useStore((s) => s.patchesLoading);
  const error = useStore((s) => s.patchesError);

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

  const cellProps = useMemo<CellProps>(
    () => ({
      patches,
      scanName: selectedScanName ?? "",
      columnCount,
      tileSize: TILE_SIZE,
    }),
    [patches, selectedScanName, columnCount],
  );

  const right = patches.length > 0 ? (
    <span className="font-mono text-[10px] text-(--color-fg-dim)">
      {patches.length.toLocaleString()} patches
    </span>
  ) : null;

  return (
    <Panel title="Patches" right={right} bodyClassName="overflow-hidden">
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
    </Panel>
  );
}
