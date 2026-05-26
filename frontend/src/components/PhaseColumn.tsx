import { useStore } from "../store";
import { PhaseTabs } from "./PhaseTabs";
import { Phase1View } from "./Phase1View";
import { Phase2View } from "./Phase2View";
import { Phase3View } from "./Phase3View";

export function PhaseColumn() {
  const phase = useStore((s) => s.currentPhase);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="overflow-hidden rounded-lg border border-(--color-panel-border)">
        <PhaseTabs />
      </div>
      <div className="min-h-0 flex-1">
        {phase === 1 && <Phase1View />}
        {phase === 2 && <Phase2View />}
        {phase === 3 && <Phase3View />}
      </div>
    </div>
  );
}
