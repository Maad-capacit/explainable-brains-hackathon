import { Brain } from "lucide-react";
import { useStore } from "../store";

export function TopBar() {
  const selected = useStore((s) => s.selectedScanName);

  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-(--color-panel-border) px-4 py-3">
      <Brain size={18} className="text-(--color-highlight)" />
      <h1 className="text-sm font-semibold tracking-wide">Mouse Brain Patch Viewer</h1>
      <span className="text-(--color-fg-dim)">/</span>
      <span className="font-mono text-xs text-(--color-fg-dim)">
        {selected ?? "no brain selected"}
      </span>
    </header>
  );
}
