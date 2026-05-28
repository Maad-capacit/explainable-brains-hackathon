import { useEffect } from "react";
import { TopBar } from "./components/TopBar";
import { BrainListPanel } from "./components/BrainListPanel";
import { PhaseColumn } from "./components/PhaseColumn";
import { PromptPanel } from "./components/PromptPanel";
import { CoordScatter } from "./components/CoordScatter";
import { UmapPanel } from "./components/UmapPanel";
import { HoverPreview } from "./components/HoverPreview";
import { PatchDetailModal } from "./components/PatchDetailModal";
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
        <div className="z-10">
          <BrainListPanel />
        </div>
        <div className="relative min-h-0">
          <PhaseColumn />
          <PromptPanel />
          <HoverPreview />
        </div>
        <div className="grid min-h-0 grid-rows-2 gap-3">
          <CoordScatter />
          <UmapPanel />
        </div>
      </main>
      <PatchDetailModal />
    </div>
  );
}
