import { Fragment, useEffect, useMemo } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useStore } from "../store";
import { api, type PatchMetadata } from "../lib/api";

const METADATA_ROWS: ReadonlyArray<readonly [keyof PatchMetadata, string, (v: number) => string]> = [
  ["x0", "x₀", (v) => v.toString()],
  ["y0", "y₀", (v) => v.toString()],
  ["z0", "z₀", (v) => v.toString()],
  ["z_mid_absolute", "z_mid", (v) => v.toString()],
  ["mean_intensity", "mean", (v) => v.toFixed(1)],
  ["std_intensity", "std", (v) => v.toFixed(1)],
  ["fraction_signal", "fraction_signal", (v) => v.toFixed(3)],
  ["sharpness", "sharpness", (v) => v.toFixed(1)],
  ["snr", "snr", (v) => v.toFixed(2)],
  ["local_contrast", "local_contrast", (v) => v.toFixed(2)],
  ["foreground_fraction", "foreground_fraction", (v) => v.toFixed(3)],
];

function Projection({
  patches,
  highlight,
  xKey,
  yKey,
  label,
}: {
  patches: PatchMetadata[];
  highlight: PatchMetadata;
  xKey: "x0" | "y0" | "z0";
  yKey: "x0" | "y0" | "z0";
  label: string;
}) {
  const W = 240;
  const H = 110;
  const pad = 8;

  const bounds = useMemo(() => {
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (const p of patches) {
      const x = p[xKey], y = p[yKey];
      if (x < xmin) xmin = x;
      if (x > xmax) xmax = x;
      if (y < ymin) ymin = y;
      if (y > ymax) ymax = y;
    }
    return { xmin, xmax, ymin, ymax };
  }, [patches, xKey, yKey]);

  const xRange = bounds.xmax - bounds.xmin || 1;
  const yRange = bounds.ymax - bounds.ymin || 1;
  const sx = (x: number) => pad + ((x - bounds.xmin) / xRange) * (W - 2 * pad);
  const sy = (y: number) => H - pad - ((y - bounds.ymin) / yRange) * (H - 2 * pad);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[10px] font-mono tracking-wide text-(--color-fg-dim)">
        <span>{label}</span>
        <span>
          {xKey} = {highlight[xKey]}  ·  {yKey} = {highlight[yKey]}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="block h-[110px] w-full rounded border border-(--color-panel-border) bg-black/40"
      >
        {patches.map((p) => (
          <circle
            key={p.patch_idx}
            cx={sx(p[xKey])}
            cy={sy(p[yKey])}
            r={1.3}
            fill="rgba(255,255,255,0.22)"
          />
        ))}
        <circle
          cx={sx(highlight[xKey])}
          cy={sy(highlight[yKey])}
          r={4.5}
          fill="#FFB627"
          stroke="#000"
          strokeWidth={1}
        />
      </svg>
    </div>
  );
}

export function PatchDetailModal() {
  const selectedPatchIdx = useStore((s) => s.selectedPatchIdx);
  const closeDetail = useStore((s) => s.closeDetail);
  const openDetail = useStore((s) => s.openDetail);
  const patches = useStore((s) => s.patches);
  const scanName = useStore((s) => s.selectedScanName);

  // Esc / arrow nav while open
  useEffect(() => {
    if (selectedPatchIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeDetail();
        return;
      }
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const pos = patches.findIndex((p) => p.patch_idx === selectedPatchIdx);
        if (pos < 0) return;
        const next = e.key === "ArrowRight" ? pos + 1 : pos - 1;
        const target = patches[next];
        if (target) {
          openDetail(target.patch_idx);
          e.preventDefault();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedPatchIdx, closeDetail, openDetail, patches]);

  if (selectedPatchIdx === null || !scanName) return null;
  const patch = patches.find((p) => p.patch_idx === selectedPatchIdx);
  if (!patch) return null;

  const pos = patches.findIndex((p) => p.patch_idx === selectedPatchIdx);
  const prev = patches[pos - 1] ?? null;
  const next = patches[pos + 1] ?? null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`patch ${patch.patch_idx} detail`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6 backdrop-blur"
      onClick={closeDetail}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-(--color-panel-border) bg-(--color-bg) shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-(--color-panel-border) px-5 py-3">
          <div>
            <h2 className="font-mono text-sm">
              patch <span className="text-(--color-highlight)">{patch.patch_idx}</span>
              <span className="ml-3 text-[11px] text-(--color-fg-dim)">
                {pos + 1} / {patches.length}
              </span>
            </h2>
            <p className="font-mono text-[10px] text-(--color-fg-dim)">
              {scanName} · {patch.animal_nr} · {patch.condition}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => prev && openDetail(prev.patch_idx)}
              disabled={!prev}
              aria-label="previous patch"
              className="rounded p-1.5 transition hover:bg-white/[0.06] disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => next && openDetail(next.patch_idx)}
              disabled={!next}
              aria-label="next patch"
              className="rounded p-1.5 transition hover:bg-white/[0.06] disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              onClick={closeDetail}
              aria-label="close"
              className="ml-2 rounded p-1.5 transition hover:bg-white/[0.06]"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px] gap-6 overflow-y-auto p-5">
          {/* Full-size image */}
          <div className="flex min-h-0 items-start justify-center">
            <div className="aspect-square w-full max-w-[560px] overflow-hidden rounded border border-(--color-panel-border) bg-black">
              <img
                key={`${scanName}/${patch.patch_idx}`}
                src={api.imageURL(scanName, patch.patch_idx)}
                alt={`patch ${patch.patch_idx}`}
                className="block size-full object-contain [image-rendering:pixelated]"
              />
            </div>
          </div>

          {/* Metadata + mini-projections */}
          <div className="flex flex-col gap-5">
            <section>
              <h3 className="mb-2 text-[10px] font-medium tracking-[0.16em] uppercase text-(--color-fg-dim)">
                Metadata
              </h3>
              <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 font-mono text-[11px]">
                {METADATA_ROWS.map(([key, label, fmt]) => (
                  <Fragment key={String(key)}>
                    <dt className="text-(--color-fg-dim)">{label}</dt>
                    <dd className="text-right text-(--color-fg)">{fmt(patch[key] as number)}</dd>
                  </Fragment>
                ))}
              </dl>
            </section>

            <section>
              <h3 className="mb-2 text-[10px] font-medium tracking-[0.16em] uppercase text-(--color-fg-dim)">
                Position in brain
              </h3>
              <div className="flex flex-col gap-3">
                <Projection patches={patches} highlight={patch} xKey="x0" yKey="y0" label="X · Y" />
                <Projection patches={patches} highlight={patch} xKey="x0" yKey="z0" label="X · Z" />
                <Projection patches={patches} highlight={patch} xKey="y0" yKey="z0" label="Y · Z" />
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
