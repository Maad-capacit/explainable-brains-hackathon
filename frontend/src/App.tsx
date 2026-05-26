import { useEffect } from "react";
import { TopBar } from "./components/TopBar";
import { BrainListPanel } from "./components/BrainListPanel";
import { PatchGrid } from "./components/PatchGrid";
import { CoordScatter } from "./components/CoordScatter";
import { useStore } from "./store";

export default function App() {
  const loadBrains = useStore((s) => s.loadBrains);
  useEffect(() => {
    loadBrains();
  }, [loadBrains]);

  return (
    <div className="flex h-full flex-col bg-(--color-bg)">
      <TopBar />
      <main className="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)_380px] gap-3 p-3">
        <BrainListPanel />
        <PatchGrid />
        <CoordScatter />
      </main>
    </div>
  );
}
