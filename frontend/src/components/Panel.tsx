import type { ReactNode } from "react";

interface PanelProps {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function Panel({ title, right, children, className = "", bodyClassName = "" }: PanelProps) {
  return (
    <section
      className={
        "flex h-full min-h-0 flex-col rounded-lg border border-(--color-panel-border) bg-(--color-panel) backdrop-blur-sm " +
        className
      }
    >
      {title !== undefined && (
        <header className="flex shrink-0 items-center justify-between border-b border-(--color-panel-border) px-4 py-2.5">
          <h2 className="text-[11px] font-medium tracking-[0.16em] uppercase text-(--color-fg-dim)">
            {title}
          </h2>
          {right}
        </header>
      )}
      <div className={"min-h-0 flex-1 " + bodyClassName}>{children}</div>
    </section>
  );
}
