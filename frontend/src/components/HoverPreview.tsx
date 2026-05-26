import { useMemo } from "react";
import { useStore } from "../store";
import { api } from "../lib/api";

const PREVIEW_PX = 480;

type ClusterStats = {
  size: number;
  pctOfTotal: number;
  nBrains: number;
  vehicle: number;
  semaglutide: number;
};

type GlobalStats = {
  meanX: number;
  meanY: number;
  stdX: number;
  stdY: number;
};

function describeRegion(x: number, y: number, g: GlobalStats): string {
  const zx = (x - g.meanX) / (g.stdX || 1);
  const zy = (y - g.meanY) / (g.stdY || 1);
  const r = Math.hypot(zx, zy);
  if (r < 0.6) return "the dense interior of the UMAP, where most patches live";
  if (r < 1.4) return "the mid-density band between the core and the edges";
  return "the periphery of the UMAP, which tends to hold morphologically distinctive patches";
}

function describeBalance(stats: ClusterStats): { label: string; interpretation: string } {
  const total = stats.vehicle + stats.semaglutide;
  if (total === 0) return { label: "—", interpretation: "" };
  const pV = stats.vehicle / total;
  if (pV >= 0.7) {
    return {
      label: `Vehicle-skewed (${Math.round(pV * 100)}%)`,
      interpretation: "skewed toward the Vehicle treatment group",
    };
  }
  if (pV <= 0.3) {
    return {
      label: `Semaglutide-skewed (${Math.round((1 - pV) * 100)}%)`,
      interpretation: "skewed toward the Semaglutide treatment group",
    };
  }
  return {
    label: "balanced",
    interpretation: "shared across both treatment groups",
  };
}

export function HoverPreview() {
  const point = useStore((s) => s.hoveredProjectionPoint);
  const projection = useStore((s) => s.projection);

  const { clusterStats, globalStats } = useMemo(() => {
    if (projection.length === 0) {
      return {
        clusterStats: new Map<number, ClusterStats>(),
        globalStats: { meanX: 0, meanY: 0, stdX: 1, stdY: 1 },
      };
    }
    const acc = new Map<number, { size: number; scans: Set<string>; v: number; s: number }>();
    let sumX = 0, sumY = 0;
    for (const p of projection) {
      sumX += p.x;
      sumY += p.y;
      let entry = acc.get(p.cluster_id);
      if (!entry) {
        entry = { size: 0, scans: new Set(), v: 0, s: 0 };
        acc.set(p.cluster_id, entry);
      }
      entry.size += 1;
      entry.scans.add(p.scan_name);
      if (p.group_nr === "G001") entry.v += 1;
      else if (p.group_nr === "G002") entry.s += 1;
    }
    const meanX = sumX / projection.length;
    const meanY = sumY / projection.length;
    let ssX = 0, ssY = 0;
    for (const p of projection) {
      ssX += (p.x - meanX) ** 2;
      ssY += (p.y - meanY) ** 2;
    }
    const stdX = Math.sqrt(ssX / projection.length);
    const stdY = Math.sqrt(ssY / projection.length);

    const clusterStats = new Map<number, ClusterStats>();
    for (const [id, e] of acc) {
      clusterStats.set(id, {
        size: e.size,
        pctOfTotal: e.size / projection.length,
        nBrains: e.scans.size,
        vehicle: e.v,
        semaglutide: e.s,
      });
    }
    return { clusterStats, globalStats: { meanX, meanY, stdX, stdY } };
  }, [projection]);

  if (!point) return null;

  const full = projection.find(
    (p) => p.scan_name === point.scan_name && p.patch_idx === point.patch_idx,
  );
  const groupNr = full?.group_nr ?? point.group_nr;
  const condition = groupNr === "G001" ? "Vehicle" : groupNr === "G002" ? "Semaglutide" : "unknown";
  const brainShort = point.scan_name.split("_").slice(0, 2).join("_");

  const stats = clusterStats.get(point.cluster_id);
  const balance = stats ? describeBalance(stats) : { label: "—", interpretation: "" };
  const region = describeRegion(point.x, point.y, globalStats);

  const rows: [string, string][] = [
    ["Patch", String(point.patch_idx)],
    ["Brain", brainShort],
    ["Condition", condition],
    ["Cluster", stats
      ? `${point.cluster_id}  (${stats.size} patches · ${(stats.pctOfTotal * 100).toFixed(1)}%)`
      : String(point.cluster_id)],
    ["Spread", stats ? `${stats.nBrains} / 12 brains` : "—"],
    ["Composition", balance.label],
  ];

  const prose = stats
    ? `This morphological group is ${balance.interpretation || "drawn from multiple treatments"} and the patch sits in ${region}.`
    : "Cluster statistics are still loading.";

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <div
        className="rounded-lg border border-(--color-panel-border) bg-(--color-panel)/95 p-3 shadow-2xl backdrop-blur"
        style={{ maxWidth: PREVIEW_PX + 24 }}
      >
        <img
          src={api.imageURL(point.scan_name, point.patch_idx)}
          alt=""
          width={PREVIEW_PX}
          height={PREVIEW_PX}
          className="block rounded"
          style={{ width: PREVIEW_PX, height: PREVIEW_PX, imageRendering: "pixelated" }}
        />
        <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 font-mono text-[11px]">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="font-semibold text-(--color-fg)">{label}</dt>
              <dd className="text-(--color-fg-dim)">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-[11px] leading-snug text-(--color-fg-dim)">{prose}</p>
      </div>
    </div>
  );
}
