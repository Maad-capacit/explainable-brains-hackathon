import { useStore } from "../store";
import { api } from "../lib/api";

const PREVIEW_PX = 480;

/**
 * Renders the hovered-UMAP-point patch as a large centered image.
 * Mounted inside a relative container that overlays the PatchGrid panel,
 * so it appears over the patches column without blocking the UMAP scatter.
 */
export function HoverPreview() {
  const point = useStore((s) => s.hoveredProjectionPoint);
  if (!point) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <div className="rounded-lg border border-(--color-panel-border) bg-(--color-panel)/95 p-3 shadow-2xl backdrop-blur">
        <img
          src={api.imageURL(point.scan_name, point.patch_idx)}
          alt=""
          width={PREVIEW_PX}
          height={PREVIEW_PX}
          className="block rounded"
          style={{ width: PREVIEW_PX, height: PREVIEW_PX, imageRendering: "pixelated" }}
        />
        <div className="mt-2 flex justify-between gap-2 font-mono text-[11px] text-(--color-fg-dim)">
          <span>cluster {point.cluster_id}</span>
          <span>patch {point.patch_idx}</span>
        </div>
      </div>
    </div>
  );
}
