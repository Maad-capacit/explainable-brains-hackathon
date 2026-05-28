// Shared cluster color palette. Matches matplotlib's `tab20`, so colors used in
// the per-brain validation flow line up with Maad's offline UMAP plots.
export const TAB20 = [
  "#1f77b4", "#aec7e8", "#ff7f0e", "#ffbb78",
  "#2ca02c", "#98df8a", "#d62728", "#ff9896",
  "#9467bd", "#c5b0d5", "#8c564b", "#c49c94",
  "#e377c2", "#f7b6d2", "#7f7f7f", "#c7c7c7",
  "#bcbd22", "#dbdb8d", "#17becf", "#9edae5",
];

export const clusterColor = (id: number): string => TAB20[id % TAB20.length]!;

// 24-color palette for semantic / PLIP text-vocab clusters (4 more than tab20
// since the default vocab has 24 phrases). The first 20 match TAB20 so UMAP and
// semantic modes share colors for the overlapping ids.
export const TEXT_PALETTE = [
  "#1f77b4", "#aec7e8", "#ff7f0e", "#ffbb78",
  "#2ca02c", "#98df8a", "#d62728", "#ff9896",
  "#9467bd", "#c5b0d5", "#8c564b", "#c49c94",
  "#e377c2", "#f7b6d2", "#7f7f7f", "#c7c7c7",
  "#bcbd22", "#dbdb8d", "#17becf", "#9edae5",
  "#393b79", "#637939", "#8c6d31", "#843c39",
];

export const textClusterColor = (id: number): string => TEXT_PALETTE[id % TEXT_PALETTE.length]!;
