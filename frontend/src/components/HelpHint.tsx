import { HelpCircle } from "lucide-react";

interface HelpHintProps {
  text: string;
  // Side the tooltip extends towards. Defaults to "right" — flip to "left" for
  // panels in the right column so the tooltip stays inside the viewport.
  align?: "left" | "right";
}

export function HelpHint({ text, align = "right" }: HelpHintProps) {
  return (
    <span className="group relative inline-flex">
      <HelpCircle
        size={12}
        className="cursor-help text-(--color-fg-dim) transition group-hover:text-(--color-highlight)"
        aria-label="Help"
      />
      <span
        role="tooltip"
        className={
          "pointer-events-none absolute top-full z-50 mt-1.5 hidden w-64 rounded border border-(--color-panel-border) bg-black/95 px-3 py-2 text-[11px] leading-relaxed text-(--color-fg) shadow-xl normal-case tracking-normal group-hover:block " +
          (align === "left" ? "right-0" : "left-0")
        }
      >
        {text}
      </span>
    </span>
  );
}
